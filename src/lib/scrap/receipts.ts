import type { Metal } from "./config";
import type { CalcLine, SettlementTotals } from "./calc";

export interface SettlementReceipt extends SettlementTotals {
  id: string;
  serial: string;
  shopId: string;
  shopName: string;
  employeeName: string;
  customerName: string | null;
  notes: string | null;
  metal: Metal;
  targetShares: number;
  currency: string;
  createdAt: string;
  timeZone: string;
  received: CalcLine[];
  delivered: CalcLine[];
}

export interface ScrapLineInput {
  gross: string;
  shares: string;
}

export interface IssueScrapReceiptInput {
  metal: Metal;
  target: number;
  received: ScrapLineInput[];
  delivered: ScrapLineInput[];
  ratePerGram: string;
  cashPaid: string;
  customerName: string;
  notes: string;
  timeZone: string;
}
