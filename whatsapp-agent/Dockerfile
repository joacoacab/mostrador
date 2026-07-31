FROM node:20-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim

WORKDIR /app

RUN addgroup --system appuser && adduser --system --home /home/appuser --ingroup appuser appuser

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
