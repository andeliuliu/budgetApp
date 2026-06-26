/** Extract the token from an `Authorization: Bearer <token>` header. */
export function parseBearer(header: string | undefined): string | null {
  if (!header) return null;
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  return scheme.toLowerCase() === "bearer" && token ? token : null;
}
