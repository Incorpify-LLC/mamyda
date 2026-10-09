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
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg poppler-utils unzip && rm -rf /var/lib/apt/lists/*
RUN npm install pg@8.16.3
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.output ./.output
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build /app/scripts/reminder-scheduler.mjs ./scripts/reminder-scheduler.mjs
COPY --from=build /app/scripts/migration-plan.mjs ./scripts/migration-plan.mjs
COPY --from=build /app/scripts/container-entrypoint.mjs ./scripts/container-entrypoint.mjs
COPY --from=build /app/scripts/media-worker.mjs ./scripts/media-worker.mjs
COPY --from=build /app/scripts/media-formats.ts ./scripts/media-formats.ts
COPY --from=build /app/scripts/media-credentials.ts ./scripts/media-credentials.ts
COPY --from=build /app/scripts/speech-models.ts ./scripts/speech-models.ts
EXPOSE 3000
ENTRYPOINT ["node", "scripts/container-entrypoint.mjs"]
CMD ["node", ".output/server/index.mjs"]
