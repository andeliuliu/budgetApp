import { Body, Controller, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { PlaidService } from "./plaid.service";

@Controller("plaid")
export class PlaidController {
  constructor(private readonly plaid: PlaidService) {}

  /** Mobile calls this to start Plaid Link. */
  @Post("link-token")
  @UseGuards(SupabaseAuthGuard)
  createLinkToken(@CurrentUser() user: AuthUser) {
    return this.plaid.createLinkToken(user.id);
  }

  /** Mobile posts the public token here after the user finishes Link. */
  @Post("exchange")
  @UseGuards(SupabaseAuthGuard)
  exchange(@CurrentUser() user: AuthUser, @Body("publicToken") publicToken: string) {
    return this.plaid.exchangePublicToken(user.id, publicToken);
  }

  /** Hosted Link flow: app calls this after the browser closes. */
  @Post("link/complete")
  @UseGuards(SupabaseAuthGuard)
  complete(@CurrentUser() user: AuthUser, @Body("linkToken") linkToken: string) {
    return this.plaid.completeHostedLink(user.id, linkToken);
  }

  /** Manually trigger a re-sync for an item (also runs automatically on webhook). */
  @Post("items/:id/sync")
  @UseGuards(SupabaseAuthGuard)
  sync(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.plaid.syncTransactions(id, user.id);
  }

  /** Re-sync all of the current user's connected items (pull-to-refresh). */
  @Post("sync")
  @UseGuards(SupabaseAuthGuard)
  syncAll(@CurrentUser() user: AuthUser) {
    return this.plaid.syncAllForUser(user.id);
  }

  /** Re-map stored transactions' categories after a mapping change. */
  @Post("recategorize")
  @UseGuards(SupabaseAuthGuard)
  recategorize(@CurrentUser() user: AuthUser) {
    return this.plaid.recategorizeForUser(user.id);
  }

  /** Plaid calls this webhook when new transaction data is available — unauthenticated. */
  @Post("webhook")
  @HttpCode(200)
  async webhook(@Body() payload: unknown) {
    await this.plaid.handleWebhook(payload);
    return { received: true };
  }
}
