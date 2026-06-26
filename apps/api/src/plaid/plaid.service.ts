import { parseDollars } from "@budgetapp/money";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  type Transaction as PlaidTransaction,
} from "plaid";
import { CryptoService } from "../crypto/crypto.service";
import { PrismaService } from "../prisma/prisma.service";
import { toTransactionRecord } from "./transaction-transform";

/**
 * Owns all communication with Plaid. The access token a bank login produces is
 * security-critical — it is exchanged here, encrypted, stored server-side, and
 * NEVER returned to the mobile client or logged.
 */
@Injectable()
export class PlaidService {
  private readonly logger = new Logger(PlaidService.name);
  private client: PlaidApi | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** Lazily build the Plaid client so the app can boot without keys in dev. */
  private getClient(): PlaidApi {
    if (this.client) return this.client;

    const clientId = this.config.get<string>("PLAID_CLIENT_ID");
    const secret = this.config.get<string>("PLAID_SECRET");
    const env = this.config.get<string>("PLAID_ENV") ?? "sandbox";

    if (!clientId || !secret) {
      throw new Error("PLAID_CLIENT_ID / PLAID_SECRET are not configured");
    }

    const configuration = new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: { "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret },
      },
    });
    this.client = new PlaidApi(configuration);
    return this.client;
  }

  /** Step 1 of Plaid Link: hand the mobile app a short-lived link token. */
  async createLinkToken(userId: string) {
    const client = this.getClient();
    const res = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "budgetApp",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      webhook: this.config.get<string>("PLAID_WEBHOOK_URL") || undefined,
    });
    return res.data;
  }

  /**
   * Step 2: exchange the public token Link returns for a permanent access
   * token, encrypt it, persist the item + accounts, and kick off the first
   * transactions sync.
   */
  async exchangePublicToken(
    userId: string,
    publicToken: string,
  ): Promise<{ itemId: string }> {
    const client = this.getClient();
    const exchange = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchange.data.access_token;
    const plaidItemId = exchange.data.item_id;

    const accountsRes = await client.accountsGet({ access_token: accessToken });
    const institutionName = await this.resolveInstitutionName(
      accountsRes.data.item.institution_id ?? null,
    );

    // Ensure the user row exists (mirrors Supabase auth.users).
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });

    const item = await this.prisma.plaidItem.create({
      data: {
        userId,
        plaidItemId,
        institutionName,
        accessTokenEnc: this.crypto.encrypt(accessToken),
        accounts: {
          create: accountsRes.data.accounts.map((a) => ({
            user: { connect: { id: userId } },
            plaidAccountId: a.account_id,
            name: a.name,
            mask: a.mask ?? null,
            type: String(a.type),
            subtype: a.subtype ? String(a.subtype) : null,
            currentBalanceCents:
              a.balances.current != null ? parseDollars(a.balances.current) : null,
            availableBalanceCents:
              a.balances.available != null
                ? parseDollars(a.balances.available)
                : null,
          })),
        },
      },
    });

    // Don't block the Link response on the first sync.
    void this.syncTransactions(item.id).catch((err) =>
      this.logger.error(`Initial sync failed for item ${item.id}: ${err}`),
    );

    return { itemId: item.id };
  }

  private async resolveInstitutionName(
    institutionId: string | null,
  ): Promise<string | null> {
    if (!institutionId) return null;
    try {
      const res = await this.getClient().institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      return res.data.institution.name;
    } catch {
      return null; // non-fatal
    }
  }

  /**
   * Cursor-based /transactions/sync ingestion: pull added/modified/removed in
   * pages until caught up, apply them idempotently, then advance the cursor.
   */
  async syncTransactions(
    itemId: string,
  ): Promise<{ added: number; modified: number; removed: number }> {
    const item = await this.prisma.plaidItem.findUnique({
      where: { id: itemId },
      include: { accounts: true },
    });
    if (!item) throw new NotFoundException(`Plaid item ${itemId} not found`);

    const client = this.getClient();
    const accessToken = this.crypto.decrypt(item.accessTokenEnc);
    const accountIdByPlaidId = new Map(
      item.accounts.map((a) => [a.plaidAccountId, a.id]),
    );

    const added: PlaidTransaction[] = [];
    const modified: PlaidTransaction[] = [];
    const removed: string[] = [];
    let cursor = item.transactionsCursor ?? undefined;
    let hasMore = true;

    while (hasMore) {
      const res = await client.transactionsSync({
        access_token: accessToken,
        cursor,
      });
      added.push(...res.data.added);
      modified.push(...res.data.modified);
      removed.push(...res.data.removed.map((r) => r.transaction_id ?? ""));
      hasMore = res.data.has_more;
      cursor = res.data.next_cursor;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const pt of [...added, ...modified]) {
        const accountId = accountIdByPlaidId.get(pt.account_id);
        if (!accountId) continue; // belongs to an account we don't track
        const record = toTransactionRecord(pt, accountId, item.userId);
        await tx.transaction.upsert({
          where: { plaidTransactionId: record.plaidTransactionId },
          create: record,
          update: record,
        });
      }
      if (removed.length > 0) {
        await tx.transaction.deleteMany({
          where: { plaidTransactionId: { in: removed.filter(Boolean) } },
        });
      }
      await tx.plaidItem.update({
        where: { id: itemId },
        data: { transactionsCursor: cursor },
      });
    });

    this.logger.log(
      `Synced item ${itemId}: +${added.length} ~${modified.length} -${removed.length}`,
    );
    return {
      added: added.length,
      modified: modified.length,
      removed: removed.length,
    };
  }

  /** Plaid calls this when new transaction data is available. */
  async handleWebhook(payload: unknown): Promise<void> {
    // TODO: verify the Plaid webhook JWT (Plaid-Verification header) first.
    const body = payload as { item_id?: string; webhook_code?: string };
    if (!body?.item_id) return;

    const item = await this.prisma.plaidItem.findUnique({
      where: { plaidItemId: body.item_id },
    });
    if (!item) {
      this.logger.warn(`Webhook for unknown item ${body.item_id}`);
      return;
    }
    await this.syncTransactions(item.id);
  }
}
