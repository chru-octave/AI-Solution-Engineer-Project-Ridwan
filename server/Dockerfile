FROM node:20-alpine AS base
WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm install

COPY server/tsconfig.json ./
COPY server/prisma ./prisma/
RUN npx prisma generate

COPY server/src ./src/
RUN npm run build && cp -r src/public dist/public

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
