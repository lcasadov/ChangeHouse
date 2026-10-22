# Imagen de la API para Cloud Run. Se construye desde la raíz del monorepo:
#   docker build -f services/api/Dockerfile -t changehouse-api .
FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @changehouse/api... \
 && pnpm --filter @changehouse/api... build \
 && pnpm --filter @changehouse/api deploy --legacy --prod /out

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
