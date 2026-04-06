import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import * as etlService from '../services/etlService';
import type { EtlDocType, EtlSourceType, IEtlImportResult } from '../types/etl';

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, ' ');
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
  const dmy = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function parseAmount(val: unknown): number {
  if (typeof val === 'number') return Math.abs(val);
  const str = String(val ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[КкДд]$/, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

function detectDocType(debitAccount: string): EtlDocType {
  const acc = debitAccount.trim();
  if (acc.startsWith('51') || acc.startsWith('52') || acc.startsWith('55')) return 'receipt';
  if (acc.startsWith('60') || acc.startsWith('76')) return 'debt_correction';
  return 'other';
}

function parseAnalyticsKt(text: string): { counterparty: string; contract: string } {
  const trimmed = text.trim();
  const contractMatch = trimmed.match(/(ДГ\s*№[^,\n]+|Договор\s*№[^,\n]+|Дог\.\s*№[^,\n]+)/i);
  if (contractMatch) {
    const contractStart = trimmed.indexOf(contractMatch[0]);
    const counterparty = trimmed.slice(0, contractStart).trim().replace(/\s+/g, ' ');
    const contract = contractMatch[0].trim();
    return { counterparty, contract };
  }
  const firstLine = trimmed.split('\n')[0].trim();
  return { counterparty: firstLine, contract: '' };
}

interface IColumnMapping {
  docDate: number;
  document: number;
  analyticsDt: number;
  analyticsKt: number;
  debitAccount: number;
  creditAccount: number;
  amountCol: number; // Для сч.62 — кредит сумма, для сч.51 — дебет сумма
}

function getCellString(sheet: XLSX.WorkSheet, r: number, c: number): string {
  if (c < 0) return '';
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return '';
  return String(cell.w ?? cell.v ?? '').trim();
}

function getCellRaw(sheet: XLSX.WorkSheet, r: number, c: number): unknown {
  if (c < 0) return undefined;
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return undefined;
  if (cell.t === 'd' && cell.v instanceof Date) return cell.v;
  return cell.v ?? cell.w;
}

function detectColumns(
  sheet: XLSX.WorkSheet,
  sourceType: EtlSourceType
): { mapping: IColumnMapping; dataStartRow: number } | null {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const maxScanRow = Math.min(range.s.r + 15, range.e.r);

  const getH = (r: number, c: number): string => {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    return normalizeHeader(String(cell?.v ?? cell?.w ?? ''));
  };

  let headerRow = -1;
  for (let r = range.s.r; r <= maxScanRow; r++) {
    for (let c = range.s.c; c <= Math.min(range.s.c + 5, range.e.c); c++) {
      const h = getH(r, c);
      if (h === 'период' || h === 'дата') {
        headerRow = r;
        break;
      }
    }
    if (headerRow >= 0) break;
  }

  if (headerRow < 0) {
    console.error('[ETL] Не найден заголовок «Период» в первых 15 строках');
    return null;
  }

  const debugRow0: string[] = [];
  const debugRow1: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    debugRow0.push(`[${c}]="${getH(headerRow, c)}"`);
    debugRow1.push(`[${c}]="${getH(headerRow + 1, c)}"`);
  }
  console.log('[ETL] Row0:', debugRow0.join(' | '));
  console.log('[ETL] Row1:', debugRow1.join(' | '));

  const mapping: Partial<IColumnMapping> = {};
  let debitCol = -1;
  let creditCol = -1;

  for (let c = range.s.c; c <= range.e.c; c++) {
    const h0 = getH(headerRow, c);
    if (h0 === 'период' || h0 === 'дата') mapping.docDate = c;
    else if (h0 === 'документ') mapping.document = c;
    else if (h0 === 'аналитика дт') mapping.analyticsDt = c;
    else if (h0 === 'аналитика кт') mapping.analyticsKt = c;
    else if (h0 === 'дебет') debitCol = c;
    else if (h0 === 'кредит') creditCol = c;
  }

  if (debitCol >= 0) {
    const h1 = getH(headerRow + 1, debitCol);
    if (h1 === 'счет' || h1 === '') {
      mapping.debitAccount = debitCol;
    }
  }

  if (creditCol >= 0) {
    const h1 = getH(headerRow + 1, creditCol);
    if (h1 === 'счет' || h1 === '') {
      mapping.creditAccount = creditCol;
    }
  }

  if (debitCol < 0 || creditCol < 0) {
    const accountCols: number[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const h1 = getH(headerRow + 1, c);
      if (h1 === 'счет') accountCols.push(c);
    }
    if (accountCols.length >= 2) {
      if (mapping.debitAccount === undefined) mapping.debitAccount = accountCols[0];
      if (mapping.creditAccount === undefined) mapping.creditAccount = accountCols[1];
    }
  }

  // Для сч.51 берём Дебет Сумму (debitCol+1), для сч.62 — Кредит Сумму (creditCol+1)
  if (sourceType === 'account_51') {
    mapping.amountCol = (mapping.debitAccount ?? debitCol) + 1;
  } else {
    mapping.amountCol = (mapping.creditAccount ?? creditCol) + 1;
  }

  let hasSubHeader = false;
  for (let c = range.s.c; c <= range.e.c; c++) {
    if (getH(headerRow + 1, c) === 'счет') {
      hasSubHeader = true;
      break;
    }
  }

  console.log('[ETL] Mapping:', {
    sourceType, docDate: mapping.docDate, document: mapping.document,
    analyticsDt: mapping.analyticsDt, analyticsKt: mapping.analyticsKt,
    debitAccount: mapping.debitAccount, creditAccount: mapping.creditAccount,
    amountCol: mapping.amountCol, debitCol, creditCol, hasSubHeader,
  });

  if (mapping.docDate === undefined || mapping.amountCol === undefined) {
    console.error('[ETL] Не удалось определить обязательные колонки');
    return null;
  }

  return {
    mapping: {
      docDate: mapping.docDate ?? -1,
      document: mapping.document ?? -1,
      analyticsDt: mapping.analyticsDt ?? -1,
      analyticsKt: mapping.analyticsKt ?? -1,
      debitAccount: mapping.debitAccount ?? -1,
      creditAccount: mapping.creditAccount ?? -1,
      amountCol: mapping.amountCol,
    },
    dataStartRow: headerRow + (hasSubHeader ? 2 : 1),
  };
}

interface IUseEtlImportResult {
  importing: boolean;
  lastResult: IEtlImportResult | null;
  error: string | null;
  importFile: (file: File, sourceType: EtlSourceType) => Promise<IEtlImportResult | null>;
}

export function useEtlImport(): IUseEtlImportResult {
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<IEtlImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importFile = useCallback(async (file: File, sourceType: EtlSourceType): Promise<IEtlImportResult | null> => {
    setImporting(true);
    setError(null);
    setLastResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

      const detected = detectColumns(sheet, sourceType);
      if (!detected) {
        const accountName = sourceType === 'account_51' ? '51' : '62';
        throw new Error(`Не удалось определить колонки карточки счета ${accountName}`);
      }

      const { mapping: col, dataStartRow } = detected;
      const batchId = crypto.randomUUID();
      const entries: Array<Parameters<typeof etlService.insertEntries>[0][0]> = [];
      const skipped: string[] = [];

      for (let r = dataStartRow; r <= range.e.r; r++) {
        const firstCell = getCellString(sheet, r, col.docDate);
        if (!firstCell) continue;
        const lower = firstCell.toLowerCase();
        if (lower.includes('сальдо') || lower.includes('итого') || lower.includes('обороты')) continue;

        const docDate = parseDate(getCellRaw(sheet, r, col.docDate));
        if (!docDate) {
          skipped.push(`Строка ${r + 1}: невалидная дата "${firstCell}"`);
          continue;
        }

        const amount = parseAmount(getCellRaw(sheet, r, col.amountCol));
        if (amount === 0) continue;

        const document = getCellString(sheet, r, col.document);
        const analyticsDt = getCellString(sheet, r, col.analyticsDt);
        const analyticsKt = getCellString(sheet, r, col.analyticsKt);
        const debitAccount = getCellString(sheet, r, col.debitAccount);
        const creditAccount = getCellString(sheet, r, col.creditAccount);

        // Для сч.51: контрагент из Аналитика Кт, назначение платежа из Документ
        // Для сч.62: контрагент из Аналитика Кт, тип по дебет счёту
        const parsed = analyticsKt ? parseAnalyticsKt(analyticsKt) : { counterparty: '', contract: '' };

        let docType: EtlDocType;
        if (sourceType === 'account_51') {
          docType = 'receipt';
        } else {
          docType = detectDocType(debitAccount);
        }

        entries.push({
          doc_date: docDate,
          document: document || null,
          analytics_dt: analyticsDt || null,
          analytics_kt: analyticsKt || null,
          debit_account: debitAccount || null,
          credit_account: creditAccount || null,
          amount,
          doc_type: docType,
          counterparty_name: parsed.counterparty || null,
          contract_name: parsed.contract || null,
          payment_purpose: sourceType === 'account_51' ? (document || null) : null,
          source_type: sourceType,
          import_batch_id: batchId,
        });
      }

      if (entries.length === 0) {
        throw new Error(
          skipped.length > 0
            ? `Нет валидных строк. ${skipped.slice(0, 3).join('; ')}`
            : 'Файл не содержит данных или формат не распознан'
        );
      }

      if (skipped.length > 0) {
        console.warn('[ETL] Пропущено строк:', skipped);
      }

      // Дедупликация
      const existing = await etlService.getEntries();
      const existingKeys = new Set(
        existing.map((e) =>
          `${e.doc_date}|${e.amount}|${e.counterparty_name ?? ''}|${e.contract_name ?? ''}|${e.debit_account ?? ''}`
        )
      );
      const uniqueEntries = entries.filter((e) => {
        const key = `${e.doc_date}|${e.amount}|${e.counterparty_name ?? ''}|${e.contract_name ?? ''}|${e.debit_account ?? ''}`;
        return !existingKeys.has(key);
      });

      if (uniqueEntries.length === 0) {
        throw new Error(`Все ${entries.length} проводок уже были импортированы ранее`);
      }

      if (uniqueEntries.length < entries.length) {
        console.warn(`[ETL] Дедупликация: ${entries.length - uniqueEntries.length} дублей отброшено`);
      }

      await etlService.insertEntries(uniqueEntries);
      const routeResult = await etlService.routeBatch(batchId);
      await etlService.syncBdds();

      const result: IEtlImportResult = {
        total: uniqueEntries.length,
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
