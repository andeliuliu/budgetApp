import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../auth/current-user.decorator";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

/** Read-only access to the current user's synced financial data. */
@Controller()
@UseGuards(SupabaseAuthGuard)
export class LedgerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("accounts")
  accounts(@CurrentUser() user: AuthUser) {
    return this.prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });
  }

  @Get("transactions")
  transactions(
    @CurrentUser() user: AuthUser,
    @Query("limit") limit?: string,
    @Query("category") category?: string,
  ) {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return this.prisma.transaction.findMany({
      where: { userId: user.id, ...(category ? { category } : {}) },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
    });
  }
}
