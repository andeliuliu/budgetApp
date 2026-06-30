# Build context is the REPO ROOT (monorepo needs the lockfile + workspace packages).
# ponytail: single-stage — bigger image, but dodges the two real footguns:
#   pnpm symlinked node_modules across stages, and stripping the Prisma CLI needed for migrate.
# Upgrade path: `pnpm deploy --filter @budgetapp/api` into a slim runtime stage if image size bites.
FROM node:20-slim

# Prisma's query engine needs openssl at runtime on debian-slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app
COPY . .

# generate Prisma client first (nest build typechecks against @prisma/client),
# then turbo builds @budgetapp/types, @budgetapp/money, and the API in dependency order.
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @budgetapp/api db:generate \
  && pnpm build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Run migrations on boot, then start. ponytail: fine for one instance; Prisma takes an
# advisory lock so it's race-safe, but move to a Fly release_command if you scale out.
CMD ["sh", "-c", "pnpm --filter @budgetapp/api db:deploy && node apps/api/dist/main.js"]
