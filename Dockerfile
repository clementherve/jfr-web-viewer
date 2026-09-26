# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
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

EXPOSE 80
