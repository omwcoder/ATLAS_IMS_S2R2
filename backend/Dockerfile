FROM node:20-slim

# Install OpenSSL — required by Prisma on Debian slim
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and prisma schema first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci && npx prisma generate

# Copy the rest of the source code
COPY . .

EXPOSE 4000

# At runtime: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
