import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";

/**
 * Owns all communication with Plaid. The access token a bank login produces is
 * security-critical — it must be exchanged here, encrypted, and stored
 * server-side. It must NEVER be returned to the mobile client.
 */
@Injectable()
export class PlaidService {
  private readonly logger = new Logger(PlaidService.name);
  private client: PlaidApi | null = null;

  constructor(private readonly config: ConfigService) {}

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
   * Step 2: exchange the public token Link returns for a permanent access token.
   * TODO(Phase 1): encrypt the access token and persist it with the plaid_item.
   */
  async exchangePublicToken(publicToken: string): Promise<{ itemId: string }> {
    const client = this.getClient();
    const res = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });
    // const accessToken = res.data.access_token; // <-- encrypt + store, never log
    this.logger.log(`Exchanged public token for item ${res.data.item_id}`);
    return { itemId: res.data.item_id };
  }

  /**
   * TODO(Phase 1): cursor-based /transactions/sync ingestion (added/modified/
   * removed), triggered by the SYNC_UPDATES_AVAILABLE webhook. Idempotent.
   */
  async handleWebhook(_payload: unknown): Promise<void> {
    // 1. verify the Plaid webhook JWT
    // 2. look up the item, run transactions/sync from the stored cursor
    // 3. upsert transactions, advance the cursor
    this.logger.debug("Received Plaid webhook (handler not yet implemented)");
  }
}
