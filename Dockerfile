FROM node:24.2.0 AS shared

WORKDIR /app

COPY ./shared/ ./shared
WORKDIR /app/shared
RUN npm install

#############################

FROM denoland/deno:2.3.7

WORKDIR /app

COPY ./server/ ./server
WORKDIR /app/server
RUN deno install --entrypoint src/server.ts

COPY --from=shared /app/shared/node_modules /app/shared/node_modules

WORKDIR /app/server
