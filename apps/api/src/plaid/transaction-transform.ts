import { parseDollars } from "@budgetapp/money";
import type { Category } from "@budgetapp/types";
import type { Transaction as PlaidTransaction } from "plaid";
import { isTransferCategory, mapPlaidCategory } from "./category-mapping";

/** Our DB-ready shape for a synced transaction (relations/timestamps excluded). */
export interface TransactionRecord {
  accountId: string;
  userId: string;
  plaidTransactionId: string;
  amountCents: number;
  isoCurrency: string;
  date: Date;
  datetime: Date | null;
  name: string;
  merchantName: string | null;
  category: Category;
  pfcPrimary: string | null;
  pfcDetailed: string | null;
  lat: number | null;
  lon: number | null;
  address: string | null;
  city: string | null;
  region: string | null;
  pending: boolean;
  isTransfer: boolean;
}

/**
 * Normalize a Plaid transaction into our record. Plaid amounts are dollars and
 * positive when money leaves the account; we keep that sign and store integer
 * cents (via the money lib, so no float drift).
 */
export function toTransactionRecord(
  tx: PlaidTransaction,
  accountId: string,
  userId: string,
): TransactionRecord {
  const pfc = tx.personal_finance_category;
  return {
    accountId,
    userId,
    plaidTransactionId: tx.transaction_id,
    amountCents: parseDollars(tx.amount),
    isoCurrency: tx.iso_currency_code ?? "USD",
    date: new Date(tx.date),
    datetime: tx.datetime ? new Date(tx.datetime) : null,
    name: tx.name,
    merchantName: tx.merchant_name ?? null,
    category: mapPlaidCategory(pfc?.primary, pfc?.detailed),
    pfcPrimary: pfc?.primary ?? null,
    pfcDetailed: pfc?.detailed ?? null,
    lat: tx.location?.lat ?? null,
    lon: tx.location?.lon ?? null,
    address: tx.location?.address ?? null,
    city: tx.location?.city ?? null,
    region: tx.location?.region ?? null,
    pending: tx.pending,
    isTransfer: isTransferCategory(pfc?.primary),
  };
}
