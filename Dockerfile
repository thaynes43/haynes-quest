FROM node:24-alpine AS app-build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN pnpm build

FROM node:24-alpine AS production-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM python:3.12-slim AS media-build
WORKDIR /app
COPY docs/assets/media ./media
COPY scripts/docs/prune_runtime_media.py ./scripts/docs/prune_runtime_media.py
RUN python scripts/docs/prune_runtime_media.py /app/media

FROM python:3.12-slim AS docs-build
WORKDIR /app
COPY requirements-docs.txt ./
RUN pip install --no-cache-dir -r requirements-docs.txt
COPY docs ./docs
COPY .agents ./.agents
COPY scripts ./scripts
COPY AGENTS.md mkdocs.yml ./
RUN scripts/docs/build.sh && python scripts/docs/retain_runtime_media_html.py site

FROM docs-build AS runtime-site-check
COPY --from=media-build /app/media /app/site/assets/media
RUN python scripts/docs/check_runtime_site.py /app/site && touch /app/runtime-site-ok

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=media-build --chown=node:node /app/media ./site/assets/media
COPY --from=app-build --chown=node:node /app/dist ./dist
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=docs-build --chown=node:node /app/site ./site
COPY --from=runtime-site-check /app/runtime-site-ok ./.runtime-site-ok
COPY --chown=node:node package.json ./
COPY --chown=node:node migrations ./migrations
USER node
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
