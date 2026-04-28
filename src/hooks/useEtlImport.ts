import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import * as etlService from '../services/etlService';
import * as bankAccountsService from '../services/bankAccountsService';
import type { EtlDocType, EtlSourceType, IEtlImportResult, IBankAccount } from '../types/etl';

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
  // Знак сохраняем: в карточке сч.51 1С сторнирующие проводки отражаются
  // парой строк (−X и +X), и Math.abs() их превращал в две положительные
  // суммы, что искажало баланс (например, +10 900 ₽ за окт-нояб 2025).
  if (typeof val === 'number') return val;
  const str = String(val ?? '')
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[КкДд]$/, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function detectDocType(debitAccount: string): EtlDocType {
  const acc = debitAccount.trim();
  if (acc.startsWith('51') || acc.startsWith('52') || acc.startsWith('55')) return 'receipt';
  if (acc.startsWith('60') || acc.startsWith('76')) return 'debt_correction';
  return 'other';
}

function parseAnalyticsKt(text: string): { counterparty: string; contract: string } {
  const trimmed = text.trim();
  const firstLine = trimmed.split('\n')[0].trim();
  // № опциональный: ловим «Договор К-14 …» наравне с «Договор №К-14 …».
  // Контрагента всегда берём из первой строки, т.к. между ФИО и договором
  // может быть адрес (см. карточку сч.51 по СЗ СТАДИОН СПАРТАК).
  const contractMatch = trimmed.match(/(ДГ\s*№?\s*[^,\n]+|Договор\s*№?\s*[^,\n]+|Дог\.\s*№?\s*[^,\n]+)/i);
  if (contractMatch) {
    return { counterparty: firstLine, contract: contractMatch[0].trim() };
  }
  return { counterparty: firstLine, contract: '' };
}

interface IColumnMapping {
  docDate: number;
  document: number;
  analyticsDt: number;
  analyticsKt: number;
  debitAccount: number;
  creditAccount: number;
  debitAmountCol: number;  // Сумма справа от «Дебет/Счет»
  creditAmountCol: number; // Сумма справа от «Кредит/Счет»
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

function detectBankAccountFromHeader(
  sheet: XLSX.WorkSheet,
  headerRow: number
): string | null {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const startRow = range.s.r;
  const endRow = Math.max(startRow, headerRow - 1);

  for (let r = startRow; r <= endRow; r++) {
    const parts: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      parts.push(getCellString(sheet, r, c));
    }
    const line = parts.join(' ');
    const match = line.match(/(?<!\d)(\d{20})(?!\d)/);
    if (match) return match[1];
  }
  return null;
}

function detectColumns(
  sheet: XLSX.WorkSheet,
  sourceType: EtlSourceType
): { mapping: IColumnMapping; dataStartRow: number; headerRow: number } | null {
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

  mapping.debitAmountCol = (mapping.debitAccount ?? debitCol) + 1;
  mapping.creditAmountCol = (mapping.creditAccount ?? creditCol) + 1;

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
    debitAmountCol: mapping.debitAmountCol, creditAmountCol: mapping.creditAmountCol,
    debitCol, creditCol, hasSubHeader,
  });

  if (mapping.docDate === undefined || mapping.debitAmountCol === undefined || mapping.creditAmountCol === undefined) {
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
      debitAmountCol: mapping.debitAmountCol,
      creditAmountCol: mapping.creditAmountCol,
    },
    dataStartRow: headerRow + (hasSubHeader ? 2 : 1),
    headerRow,
  };
}

interface IUseEtlImportResult {
  importing: boolean;
  lastResult: IEtlImportResult | null;
  error: string | null;
  importFile: (file: File, sourceType: EtlSourceType, bankAccountId?: string | null) => Promise<IEtlImportResult | null>;
}

export function useEtlImport(): IUseEtlImportResult {
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<IEtlImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importFile = useCallback(async (file: File, sourceType: EtlSourceType, bankAccountId?: string | null): Promise<IEtlImportResult | null> => {
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

      const { mapping: col, dataStartRow, headerRow } = detected;
      const batchId = crypto.randomUUID();
      const entries: Array<Parameters<typeof etlService.insertEntries>[0][0]> = [];
      const skipped: string[] = [];

      // Загружаем справочник р/с для распознавания внутренних переводов
      let ownAccounts: IBankAccount[] = [];
      if (sourceType === 'account_51') {
        try { ownAccounts = await bankAccountsService.getAll(); } catch { /* ignore */ }
      }

      // Авто-распознавание р/с из шапки карточки сч.51
      let effectiveBankAccountId: string | null = bankAccountId || null;
      let detectedBankAccount: IEtlImportResult['detectedBankAccount'] = null;
      let selectedMismatch = false;
      if (sourceType === 'account_51') {
        const detectedNumber = detectBankAccountFromHeader(sheet, headerRow);
        if (detectedNumber) {
          const matched = ownAccounts.find((a) => a.account_number === detectedNumber);
          if (matched) {
            effectiveBankAccountId = matched.id;
            detectedBankAccount = {
              id: matched.id,
              account_number: matched.account_number,
              bank_name: matched.bank_name,
            };
            if (bankAccountId && bankAccountId !== matched.id) {
              selectedMismatch = true;
            }
          } else {
            throw new Error(
              `В файле указан р/с ${detectedNumber}, его нет в справочнике. Добавьте р/с в Справочниках или выберите из списка вручную.`
            );
          }
        } else if (!bankAccountId) {
          throw new Error(
            'Не удалось определить р/с из файла и он не выбран вручную. Выберите р/с в списке.'
          );
        }
      }

      const findOwnAccountInText = (text: string) =>
        ownAccounts.find((a) => text.includes(a.account_number)) ?? null;

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

        const document = getCellString(sheet, r, col.document);
        const analyticsDt = getCellString(sheet, r, col.analyticsDt);
        const analyticsKt = getCellString(sheet, r, col.analyticsKt);
        const debitAccount = getCellString(sheet, r, col.debitAccount);
        const creditAccount = getCellString(sheet, r, col.creditAccount);
        const debitAmount = parseAmount(getCellRaw(sheet, r, col.debitAmountCol));
        const creditAmount = parseAmount(getCellRaw(sheet, r, col.creditAmountCol));

        let amount = 0;
        let docType: EtlDocType;
        let counterpartyText = '';
        let targetBankAccountId: string | null = null;

        if (sourceType === 'account_62') {
          amount = creditAmount;
          if (amount === 0) continue;
          counterpartyText = analyticsKt;
          docType = detectDocType(debitAccount);
        } else {
          // account_51 — различаем приход/расход/внутренний перевод
          const is51Dt = debitAccount.startsWith('51');
          const is51Kt = creditAccount.startsWith('51');

          if (is51Dt && !is51Kt) {
            // Приход на наш 51 (Дт 51, Кт 62/60/76/…)
            amount = debitAmount;
            if (amount === 0) continue;
            counterpartyText = analyticsKt;
            docType = creditAccount.startsWith('60') || creditAccount.startsWith('76')
              ? 'debt_correction'
              : 'receipt';
          } else if (!is51Dt && is51Kt) {
            // Расход с нашего 51 (Дт 91/60/76/…, Кт 51)
            amount = creditAmount;
            if (amount === 0) continue;
            counterpartyText = analyticsDt;
            docType = 'expense';
          } else if (is51Dt && is51Kt) {
            // Внутренний перевод между нашими р/с (Дт 51, Кт 51)
            docType = 'internal_transfer';
            if (debitAmount !== 0) {
              // Приход с другого нашего р/с → source в Аналитика Кт
              amount = debitAmount;
              counterpartyText = analyticsKt;
              targetBankAccountId = findOwnAccountInText(analyticsKt)?.id ?? null;
            } else if (creditAmount !== 0) {
              // Уход на другой наш р/с → destination в Аналитика Дт
              amount = creditAmount;
              counterpartyText = analyticsDt;
              targetBankAccountId = findOwnAccountInText(analyticsDt)?.id ?? null;
            } else {
              continue;
            }
          } else {
            // Обе стороны не 51 — мусор, пропускаем
            continue;
          }
        }

        const parsed = counterpartyText ? parseAnalyticsKt(counterpartyText) : { counterparty: '', contract: '' };

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
          bank_account_id: sourceType === 'account_51' ? effectiveBankAccountId : (bankAccountId || null),
          target_bank_account_id: targetBankAccountId,
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

      // Дедупликация: ключ включает analytics_dt + analytics_kt, чтобы строки одного
      // СП-документа с одинаковой суммой (разбиение платежа по нескольким
      // накладным/субсчетам, частая ситуация в карточке сч.51) не схлопывались.
      // Без этого, например, СП00-005212 на 258 000 × 12 рядов превращался в одну
      // запись и из баланса терялось 11 × 258 000 = 2 838 000 ₽.
      const makeKey = (e: {
        doc_date: string;
        amount: number;
        counterparty_name: string | null;
        contract_name: string | null;
        debit_account: string | null;
        document?: string | null;
        analytics_dt?: string | null;
        analytics_kt?: string | null;
      }) =>
        `${e.doc_date}|${e.amount}|${e.counterparty_name ?? ''}|${e.contract_name ?? ''}|${e.debit_account ?? ''}|${e.document ?? ''}|${e.analytics_dt ?? ''}|${e.analytics_kt ?? ''}`;

      const dates = entries.map((e) => e.doc_date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      const existing = await etlService.getEntriesForDateRange(minDate, maxDate);
      const existingKeys = new Set(existing.map(makeKey));
      const seen = new Set<string>();
      const uniqueEntries = entries.filter((e) => {
        const key = makeKey(e);
        if (existingKeys.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
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
        detectedBankAccount,
        selectedMismatch,
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
