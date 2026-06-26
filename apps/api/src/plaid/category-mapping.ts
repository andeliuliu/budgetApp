import type { Category } from "@budgetapp/types";

/**
 * Map Plaid's Personal Finance Category (PFC) taxonomy onto budgetApp's
 * user-facing categories. Detailed categories override the primary where they
 * carry more meaning (e.g. groceries vs. dining, rent vs. other utilities).
 *
 * Anything we can't confidently classify falls through to "other" — the user
 * can always re-categorize, and a wrong guess is worse than an honest "other".
 */
export function mapPlaidCategory(
  pfcPrimary?: string | null,
  pfcDetailed?: string | null,
): Category {
  const primary = (pfcPrimary ?? "").toUpperCase();
  const detailed = (pfcDetailed ?? "").toUpperCase();

  // Detailed overrides
  if (detailed === "FOOD_AND_DRINK_GROCERIES") return "grocery";
  if (detailed.startsWith("RENT_AND_UTILITIES_RENT")) return "rent";

  switch (primary) {
    case "FOOD_AND_DRINK":
      return "dining";
    case "GENERAL_MERCHANDISE":
      return "shopping";
    case "RENT_AND_UTILITIES":
      return "utilities";
    case "LOAN_PAYMENTS":
      return "loans";
    case "TRANSFER_IN":
    case "TRANSFER_OUT":
      return "transfers";
    default:
      return "other";
  }
}

/** Transfers (e.g. Chase ↔ SoFi) shouldn't count as spend. */
export function isTransferCategory(pfcPrimary?: string | null): boolean {
  const p = (pfcPrimary ?? "").toUpperCase();
  return p === "TRANSFER_IN" || p === "TRANSFER_OUT";
}
