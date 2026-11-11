export type RecurringConflict = { date: string; time: string; message: string };

export type RecurringVisit = {
  id: string;
  date: string;
  dateValue: string;
  time: string;
  status: string;
  serviceNames: string[];
  barberName: string;
  canEdit: boolean;
};

export type RecurringSeriesSummary = {
  batchKey: string;
  seriesId: string | null;
  customerName: string;
  customerId: string | null;
  barberName: string;
  serviceNames: string[];
  repeatForever: boolean;
  intervalDays: number | null;
  useVipPlan: boolean;
  vipPlanName: string | null;
  status: "ACTIVE" | "CANCELLED" | "FINISHED";
  nextDate: string | null;
  time: string | null;
  conflicts: RecurringConflict[];
  appointments: RecurringVisit[];
  futureCount: number;
  hasMoreHistory: boolean;
  historyCursor: string | null;
};
