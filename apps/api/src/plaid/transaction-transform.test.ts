import type { Transaction as PlaidTransaction } from "plaid";
import { describe, expect, it } from "vitest";
import { toTransactionRecord } from "./transaction-transform";

function fakePlaidTx(overrides: Partial<PlaidTransaction> = {}): PlaidTransaction {
  return {
    transaction_id: "txn_1",
    account_id: "acc_1",
    amount: 42.5,
    iso_currency_code: "USD",
    date: "2026-06-20",
    datetime: "2026-06-20T18:30:00Z",
    name: "Whole Foods",
    merchant_name: "Whole Foods Market",
    pending: false,
    personal_finance_category: {
      primary: "FOOD_AND_DRINK",
      detailed: "FOOD_AND_DRINK_GROCERIES",
      confidence_level: "VERY_HIGH",
    },
    location: { lat: 40.7, lon: -74.0, address: "123 Main St", city: "NYC", region: "NY" },
    ...overrides,
  } as unknown as PlaidTransaction;
}

describe("toTransactionRecord", () => {
  it("normalizes amount to integer cents without float drift", () => {
    expect(toTransactionRecord(fakePlaidTx({ amount: 0.1 + 0.2 }), "a", "u").amountCents).toBe(30);
    expect(toTransactionRecord(fakePlaidTx(), "a", "u").amountCents).toBe(4250);
  });

  it("derives category from PFC and carries location/time", () => {
    const r = toTransactionRecord(fakePlaidTx(), "acc-uuid", "user-uuid");
    expect(r.category).toBe("grocery");
    expect(r.isTransfer).toBe(false);
    expect(r.reviewed).toBe(false); // real spend starts unreviewed (pending queue)
    expect(r.lat).toBe(40.7);
    expect(r.datetime).toEqual(new Date("2026-06-20T18:30:00Z"));
    expect(r.accountId).toBe("acc-uuid");
  });

  it("flags transfers and tolerates missing optional fields", () => {
    const r = toTransactionRecord(
      fakePlaidTx({
        merchant_name: null,
        datetime: null,
        location: { lat: null, lon: null, address: null, city: null, region: null } as never,
        personal_finance_category: { primary: "TRANSFER_OUT", detailed: "TRANSFER_OUT_ACCOUNT_TRANSFER", confidence_level: "HIGH" } as never,
      }),
      "a",
      "u",
    );
    expect(r.category).toBe("other"); // transfers now fold into the "other" bin
    expect(r.isTransfer).toBe(true); // ...but are still flagged as transfers
    expect(r.reviewed).toBe(false); // ...and enter the pending queue for triage
    expect(r.merchantName).toBeNull();
    expect(r.datetime).toBeNull();
  });
});
