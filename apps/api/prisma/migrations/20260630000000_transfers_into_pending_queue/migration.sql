-- P2P transfers (Venmo/Zelle) were auto-reviewed and hidden from the triage
-- queue. Plaid can't tell what they were for, so surface the untouched ones
-- (still sitting in "other") for the user to categorize. Transfers the user
-- already filed into another category keep reviewed=true and stay put.
UPDATE "transactions" SET "reviewed" = false WHERE "is_transfer" = true AND "category" = 'other';
