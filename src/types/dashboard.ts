export interface IMonthDataPoint {
  month: string;
  value: number;
  type: string;
}

export interface ICostItem {
  month: string;
  category: string;
  value: number;
}

export interface IWaterfallItem {
  name: string;
  value: number;
}

export interface IBdrDashboardData {
  revenueByMonth: IMonthDataPoint[];
  costStructure: ICostItem[];
  waterfall: IWaterfallItem[];
  marginPercent: number;
  scurve: IMonthDataPoint[];
  kpis: {
    revenueFact: number;
    revenuePlan: number;
    marginalProfit: number;
    operatingProfit: number;
    operatingProfitPct: number;
    netProfit: number;
    costTotal: number;
  };
}

export interface IBubbleDataPoint {
  project: string;
  revenue: number;
  profitability: number;
  nzp: number;
}

export interface IExecutionVsKsPoint {
  month: string;
  value: number;
  type: 'Выполнение' | 'Актирование (КС-2)';
}

export interface IIncomeByProjectPoint {
  month: string;
  value: number;
  project: string;
}

export interface IMaterialsDeltaData {
  columns: Array<{ month: string; value: number; type: string }>;
  line: Array<{ month: string; value: number; type: string }>;
}

export interface IBddsDashboardData {
  planFactIncome: IMonthDataPoint[];
  incomeByProject: IIncomeByProjectPoint[];
  planIncomeLine: IMonthDataPoint[];
  ncfBySection: IMonthDataPoint[];
  kpis: {
    ncfOperating: number;
    ncfInvesting: number;
    ncfFinancing: number;
    ncfTotal: number;
    planIncomeTotal: number;
    factIncomeTotal: number;
  };
}
