import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseBearer } from "./bearer";
import type { AuthUser } from "./current-user.decorator";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
    }>();

    const token = parseBearer(req.headers.authorization);
    if (!token) throw new UnauthorizedException("Missing bearer token");

    const url = this.config.get<string>("SUPABASE_URL");
    const anonKey = this.config.get<string>("SUPABASE_ANON_KEY");
    if (!url || !anonKey) {
      throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not configured");
    }

    // ponytail: let Supabase verify the token via its own endpoint (native fetch,
    // no SDK). Swap to local jose + JWKS verification if per-request latency bites.
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new UnauthorizedException("Invalid or expired token");

    const user = (await res.json()) as { id: string; email?: string | null };
    req.user = { id: user.id, email: user.email ?? null };
    return true;
  }
}
