import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CATEGORIES, type Category } from "@budgetapp/types";
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
    @Query("from") from?: string, // inclusive ISO date (YYYY-MM-DD)
    @Query("to") to?: string, // exclusive ISO date (e.g. first day of next month)
  ) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const dateFilter: { gte?: Date; lt?: Date } = {};
    if (fromDate && !isNaN(fromDate.getTime())) dateFilter.gte = fromDate;
    if (toDate && !isNaN(toDate.getTime())) dateFilter.lt = toDate;
    const ranged = "gte" in dateFilter || "lt" in dateFilter;

    return this.prisma.transaction.findMany({
      where: {
        userId: user.id,
        ...(category ? { category } : {}),
        ...(ranged ? { date: dateFilter } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      // A date range is naturally bounded (e.g. one month) so return all of it;
      // an open query keeps the legacy newest-100 cap to avoid a huge response.
      ...(ranged ? {} : { take: Math.min(Math.max(Number(limit) || 100, 1), 500) }),
    });
  }

  /** Edit a transaction: file into a category (drag), and/or rename / fix amount. */
  @Patch("transactions/:id")
  async updateTransaction(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body()
    body: { category?: string; merchantName?: string; amountCents?: number },
  ) {
    const data: {
      category?: string;
      reviewed?: boolean;
      merchantName?: string;
      amountCents?: number;
    } = {};

    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category as Category)) {
        throw new BadRequestException(`Unknown category: ${body.category}`);
      }
      data.category = body.category;
      data.reviewed = true; // filing it counts as triaged
    }
    if (body.merchantName !== undefined) {
      const title = String(body.merchantName).trim();
      if (!title) throw new BadRequestException("Title cannot be empty");
      data.merchantName = title;
    }
    if (body.amountCents !== undefined) {
      if (!Number.isInteger(body.amountCents)) {
        throw new BadRequestException("amountCents must be an integer");
      }
      data.amountCents = body.amountCents;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Nothing to update");
    }

    // updateMany scopes by userId so a user can't reach another user's row.
    const { count } = await this.prisma.transaction.updateMany({
      where: { id, userId: user.id },
      data,
    });
    if (count === 0) throw new NotFoundException("Transaction not found");
    return { id, ...data };
  }
}
