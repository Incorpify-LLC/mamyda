FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_AUTH_ENABLED=true
ENV NITRO_PRESET=node_server
RUN npm run build:container

FROM node:24-bookworm-slim
WORKDIR /app
RUN npm install pg@8.16.3
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.output ./.output
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build /app/scripts/migration-plan.mjs ./scripts/migration-plan.mjs
COPY --from=build /app/scripts/container-entrypoint.mjs ./scripts/container-entrypoint.mjs
EXPOSE 3000
ENTRYPOINT ["node", "scripts/container-entrypoint.mjs"]
CMD ["node", ".output/server/index.mjs"]
