# Production image for The Wig Atelier & Vault.
# The server has no npm dependencies, so there is no install step.
FROM node:22-alpine

WORKDIR /app
COPY server ./server
COPY website ./website

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/atelier.db

EXPOSE 8080
CMD ["node", "server/server.js"]
