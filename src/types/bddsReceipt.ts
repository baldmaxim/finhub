export interface BddsReceiptDetail {
  id: string;
  project_id: string;
  category_id: string;
  year: number;
  month: number;
  row_number: number | null;
  receipt_date: string | null;
  customer: string;
  contract: string;
  project_name: string;
  amount: number;
  created_at: string;
}

export interface BddsReceiptImportRow {
  row_number: number | null;
  receipt_date: string | null;
  customer: string;
  contract: string;
  project_name: string;
  amount: number;
}
