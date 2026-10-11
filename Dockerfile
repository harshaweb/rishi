FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build

# Run migrations separately from this build image as a release job.
FROM build AS release
CMD ["npm", "run", "db:migrate"]

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
USER node
EXPOSE 3001
CMD ["npm", "start"]
