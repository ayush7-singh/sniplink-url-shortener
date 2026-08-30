# Stage 1: Build & Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN apk add --no-cache curl

# Copy dependencies and application code
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Use non-root node user for security
USER node

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/healthz || exit 1

CMD ["node", "src/index.js"]
