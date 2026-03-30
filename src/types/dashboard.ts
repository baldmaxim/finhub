export interface IMonthDataPoint {
  month: string;
  value: number;
  type: string;
}

export interface ICostItem {
  month: string;
  category: string;
  value: number;
  planValue: number;
  monthTotal: number;
  planTotal: number;
  percent: number;
}

export interface IWaterfallItem {
  name: string;
  value: number;
  isTotal?: boolean;
}

export interface IMarginTrendPoint {
  month: string;
  grossMargin: number;
  netMargin: number;
  planMargin: number;
  revenueFact: number;
  revenuePlan: number;
}

export interface IBdrDashboardData {
  revenueByMonth: IMonthDataPoint[];
  revenueByMonthWithVat: IMonthDataPoint[];
  costStructure: ICostItem[];
  costCumulative: IMonthDataPoint[];
  waterfall: IWaterfallItem[];
  marginPercent: number;
  scurve: IMonthDataPoint[];
  scurveWithVat: IMonthDataPoint[];
  marginTrend: IMarginTrendPoint[];
  kpis: {
    revenueFact: number;
    revenuePlan: number;
    marginalProfit: number;
    marginalProfitPlan: number;
    operatingProfit: number;
    operatingProfitPlan: number;
    operatingProfitPct: number;
    netProfit: number;
    costTotal: number;
    costPlanTotal: number;
  };
}

export interface IBubbleDataPoint {
  project: string;
  revenue: number;
  profitability: number;
  nzp: number;
  grossProfit: number;
}

export interface IExecutionVsKsPoint {
  month: string;
  value: number;
  type: 'Выполнение' | 'Актирование (КС-2)';
}

export interface IMaterialsDeltaData {
  columns: Array<{ month: string; value: number; type: string }>;
  line: Array<{ month: string; value: number; type: string }>;
}

export interface IBddsDashboardData {
  planFactIncome: IMonthDataPoint[];
  factIncomeLine: IMonthDataPoint[];
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
