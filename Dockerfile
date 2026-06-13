# ---- Build: instala todas las deps y compila a dist/ ----
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- Runtime: solo dist/ + dependencias de producción, usuario no root ----
FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist

# Directorio de fotos de modelos, escribible por el usuario node (volumen en compose)
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 3001
CMD ["node", "dist/main"]
