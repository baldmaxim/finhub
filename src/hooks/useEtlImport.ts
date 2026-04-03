import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import * as etlService from '../services/etlService';
import type { EtlDocType, IEtlImportResult } from '../types/etl';

/** Колонки отчёта 1С по 62 счету — маппинг заголовков Excel на поля транзакции */
const COLUMN_ALIASES: Record<string, string> = {
  // Дата
  'дата': 'doc_date',
  'дата документа': 'doc_date',
  'date': 'doc_date',
  // Сумма
  'сумма': 'amount',
  'сумма документа': 'amount',
  'amount': 'amount',
  // Контрагент
  'инн': 'counterparty_inn',
  'инн контрагента': 'counterparty_inn',
  'контрагент': 'counterparty_name',
  'заказчик': 'counterparty_name',
  'плательщик': 'counterparty_name',
  // Договор
  'guid договора': 'contract_guid',
  'договор guid': 'contract_guid',
  'договор': 'contract_name',
  'наименование договора': 'contract_name',
  // Банковский счёт
  'guid банковского счета': 'bank_account_guid',
  'банковский счет guid': 'bank_account_guid',
  'счет организации': 'bank_account_name',
  'банковский счет': 'bank_account_name',
  'расчетный счет': 'bank_account_name',
  // Статья ДДС
  'guid статьи ддс': 'cashflow_item_guid',
  'статья ддс guid': 'cashflow_item_guid',
  'статья ддс': 'cashflow_item_name',
  'статья движения денежных средств': 'cashflow_item_name',
  // Назначение платежа
  'назначение платежа': 'payment_purpose',
  'назначение': 'payment_purpose',
  'основание': 'payment_purpose',
  // Тип документа
  'вид документа': 'doc_type_raw',
  'тип документа': 'doc_type_raw',
  'документ': 'doc_type_raw',
  // Субподряд (для корректировок долга)
  'guid договора субподрядчика': 'sub_contract_guid',
  'договор субподрядчика': 'sub_contract_name',
  'договор с субподрядчиком': 'sub_contract_name',
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, ' ');
}

function parseDocType(raw: string): EtlDocType {
  const lower = raw.toLowerCase();
  if (lower.includes('корректировк') || lower.includes('взаимозачет') || lower.includes('зачет')) {
    return 'debt_correction';
  }
  return 'receipt';
}

function parseDate(val: unknown): string | null {
  if (val instanceof Date) {
    const y = val.getFullYear();
    if (y < 2000 || y > 2100) return null;
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number' && val > 25000 && val < 80000) {
    const d = new Date((val - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const str = String(val ?? '').trim();
  // DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function parseAmount(val: unknown): number {
  if (typeof val === 'number') return val;
  const str = String(val ?? '').replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

interface IUseEtlImportResult {
  importing: boolean;
  lastResult: IEtlImportResult | null;
  error: string | null;
  importFile: (file: File) => Promise<IEtlImportResult | null>;
}

export function useEtlImport(): IUseEtlImportResult {
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<IEtlImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importFile = useCallback(async (file: File): Promise<IEtlImportResult | null> => {
    setImporting(true);
    setError(null);
    setLastResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (jsonData.length === 0) {
        throw new Error('Файл пуст или не содержит данных');
      }

      // Определяем маппинг колонок
      const headers = Object.keys(jsonData[0]);
      const columnMap: Record<string, string> = {};

      for (const header of headers) {
        const normalized = normalizeHeader(header);
        const field = COLUMN_ALIASES[normalized];
        if (field) {
          columnMap[header] = field;
        }
      }

      if (!Object.values(columnMap).includes('amount')) {
        throw new Error('Не найдена колонка "Сумма" в файле');
      }
      if (!Object.values(columnMap).includes('doc_date')) {
        throw new Error('Не найдена колонка "Дата" в файле');
      }

      // Генерируем batch ID
      const batchId = crypto.randomUUID();

      // Парсим строки
      const transactions: Array<Record<string, unknown>> = [];
      const errors: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const tx: Record<string, unknown> = {
          import_batch_id: batchId,
        };

        let docTypeRaw = '';

        for (const [excelCol, field] of Object.entries(columnMap)) {
          const val = row[excelCol];
          if (field === 'doc_date') {
            const date = parseDate(val);
            if (!date) {
              errors.push(`Строка ${i + 2}: невалидная дата "${val}"`);
              continue;
            }
            tx.doc_date = date;
          } else if (field === 'amount') {
            tx.amount = parseAmount(val);
          } else if (field === 'doc_type_raw') {
            docTypeRaw = String(val ?? '');
          } else {
            tx[field] = val !== undefined && val !== null ? String(val).trim() : null;
          }
        }

        if (!tx.doc_date) continue;
        if (!tx.amount || tx.amount === 0) continue;

        tx.doc_type = docTypeRaw ? parseDocType(docTypeRaw) : 'receipt';

        transactions.push(tx);
      }

      if (transactions.length === 0) {
        throw new Error(
          errors.length > 0
            ? `Не удалось распарсить строки. ${errors.slice(0, 3).join('; ')}`
            : 'Нет валидных строк для импорта'
        );
      }

      // Вставляем транзакции
      await etlService.insertTransactions(
        transactions as Parameters<typeof etlService.insertTransactions>[0]
      );

      // Запускаем маршрутизацию батча
      const routeResult = await etlService.routeBatch(batchId);

      const result: IEtlImportResult = {
        total: transactions.length,
        routed: routeResult.routed,
        quarantine: routeResult.quarantine,
        batchId,
      };

      setLastResult(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка импорта';
      setError(msg);
      return null;
    } finally {
      setImporting(false);
    }
  }, []);

  return { importing, lastResult, error, importFile };
}
