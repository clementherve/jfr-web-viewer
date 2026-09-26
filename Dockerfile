# syntax=docker/dockerfile:1

# The build output is plain static files, so build once on the native platform
# instead of under emulation for every target architecture.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app

# Corepack reads package.json's "packageManager" field to fetch the right pnpm version.
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/jfr-viewer/browser /usr/share/nginx/html
# Opt-in analytics, enabled at startup by UMAMI_* env vars (see README).
COPY --chmod=755 docker/40-umami.sh /docker-entrypoint.d/40-umami.sh

EXPOSE 80
