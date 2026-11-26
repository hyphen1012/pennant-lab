FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --chown=node:node mobile/src/save-gzip-codec.cjs ./mobile/src/save-gzip-codec.cjs
USER node
ENV PL_ENV=staging PL_DATA_DIR=/data PL_PORT=8787
EXPOSE 8787
CMD ["node","server/staging-entry.cjs"]
