FROM node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build

ENV NODE_OPTIONS=--max-old-space-size=1024 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    WRANGLER_SEND_METRICS=false
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY lib ./lib
COPY backend/accounts/preferences_catalog.json ./backend/accounts/preferences_catalog.json
COPY public ./public
COPY scripts/verify-static-paths.mjs ./scripts/verify-static-paths.mjs
COPY .openai/hosting.json ./.openai/hosting.json
COPY next.config.ts tsconfig.json vite.config.ts ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30.4-alpine@sha256:b8c179cd3c2ae222a873dd59fbae240fadc03836cae5198afc9e9c19919c3880

ARG CAPIBLOQUES_BUILD_REVISION=unknown
LABEL org.opencontainers.image.title="CapiBloques DEV static editor" \
      org.opencontainers.image.revision="${CAPIBLOQUES_BUILD_REVISION}"

USER root
RUN rm -f /etc/nginx/conf.d/default.conf
COPY --chown=101:101 ops/public-dev/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chown=101:101 ops/public-dev/container-entrypoint.sh /usr/local/bin/capibloques-entrypoint
COPY --from=build --chown=101:101 /workspace/dist/client/ /usr/share/nginx/html/
RUN chmod 0555 /usr/local/bin/capibloques-entrypoint \
    && find /usr/share/nginx/html -type d -exec chmod 0555 {} + \
    && find /usr/share/nginx/html -type f -exec chmod 0444 {} +

USER 101:101
EXPOSE 8080 8081
ENTRYPOINT ["/usr/local/bin/capibloques-entrypoint"]
CMD ["nginx", "-g", "daemon off;"]
