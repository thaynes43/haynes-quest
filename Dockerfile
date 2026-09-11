FROM node:24-alpine AS app-build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN pnpm build

FROM python:3.12-slim AS docs-build
WORKDIR /app
COPY requirements-docs.txt ./
RUN pip install --no-cache-dir -r requirements-docs.txt
COPY docs ./docs
COPY .agents ./.agents
COPY scripts ./scripts
COPY AGENTS.md mkdocs.yml ./
RUN scripts/docs/build.sh

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=app-build --chown=node:node /app/dist ./dist
COPY --from=app-build --chown=node:node /app/node_modules ./node_modules
COPY --from=docs-build --chown=node:node /app/site ./site
COPY --chown=node:node package.json ./
COPY --chown=node:node migrations ./migrations
USER node
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
