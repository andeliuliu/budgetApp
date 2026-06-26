-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaid_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plaid_item_id" TEXT NOT NULL,
    "institution_name" TEXT,
    "access_token_enc" TEXT NOT NULL,
    "transactions_cursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plaid_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plaid_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mask" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "current_balance_cents" INTEGER,
    "available_balance_cents" INTEGER,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plaid_transaction_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "iso_currency" TEXT NOT NULL DEFAULT 'USD',
    "date" DATE NOT NULL,
    "datetime" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "merchant_name" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "pfc_primary" TEXT,
    "pfc_detailed" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "is_transfer" BOOLEAN NOT NULL DEFAULT false,
    "personal_share_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "limit_cents" INTEGER NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "splits" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_participants" (
    "id" UUID NOT NULL,
    "split_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "venmo_handle" TEXT,
    "amount_owed_cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "split_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_items_plaid_item_id_key" ON "plaid_items"("plaid_item_id");

-- CreateIndex
CREATE INDEX "plaid_items_user_id_idx" ON "plaid_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_plaid_account_id_key" ON "accounts"("plaid_account_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_plaid_transaction_id_key" ON "transactions"("plaid_transaction_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_date_idx" ON "transactions"("user_id", "date");

-- CreateIndex
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_user_id_category_period_key" ON "budgets"("user_id", "category", "period");

-- CreateIndex
CREATE UNIQUE INDEX "splits_transaction_id_key" ON "splits"("transaction_id");

-- CreateIndex
CREATE INDEX "split_participants_split_id_idx" ON "split_participants"("split_id");

-- AddForeignKey
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "plaid_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splits" ADD CONSTRAINT "splits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_participants" ADD CONSTRAINT "split_participants_split_id_fkey" FOREIGN KEY ("split_id") REFERENCES "splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

