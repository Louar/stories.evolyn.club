# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:24-alpine3.23

# -------------------------------------------------------------------
# Build application
# -------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm ci --no-audit --no-fund

COPY . .

RUN --mount=type=cache,target=/app/node_modules/.vite \
    set -a && . ./.env.example && set +a && node --run build


# -------------------------------------------------------------------
# Install production dependencies
# -------------------------------------------------------------------
FROM --platform=$TARGETPLATFORM ${NODE_IMAGE} AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm ci --omit=dev --no-audit --no-fund


# -------------------------------------------------------------------
# Runtime
# -------------------------------------------------------------------
FROM --platform=$TARGETPLATFORM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN mkdir -p /data && chown node:node /data

COPY --from=production-dependencies \
    --chown=node:node \
    /app/node_modules \
    ./node_modules

COPY --from=builder \
    --chown=node:node \
    /app/build \
    ./build

COPY --from=builder \
    --chown=node:node \
    /app/static \
    ./static

COPY --chown=node:node package.json ./

USER node

EXPOSE 3000

CMD ["node", "build"]
