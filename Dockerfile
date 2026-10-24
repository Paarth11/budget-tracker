# Builds the React app and the API, then serves both from one Node process.
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server /app/server/node_modules server/node_modules
COPY --from=server /app/server/dist server/dist
COPY --from=server /app/server/package.json server/
COPY --from=client /app/client/dist client/dist
USER node
EXPOSE 4000
CMD ["node", "server/dist/app/index.js"]
