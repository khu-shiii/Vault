FROM node:20-alpine AS build
RUN apk add --no-cache python3 make g++ openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS run
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]