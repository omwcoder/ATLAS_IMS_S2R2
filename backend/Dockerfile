FROM node:20-alpine

# Install OpenSSL — required by Prisma query engine on Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy package files and prisma schema first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and pre-generate Prisma client
RUN npm ci && npx prisma generate

# Copy the rest of the source code
COPY . .

EXPOSE 4000

# At runtime: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
