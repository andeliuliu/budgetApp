import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type AuthUser = { id: string; email: string | null };

/** Injects the user that SupabaseAuthGuard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
