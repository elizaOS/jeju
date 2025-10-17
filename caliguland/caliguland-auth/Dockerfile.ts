FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm install -g typescript && npm run build

# Run as non-root user
RUN adduser -D -u 1000 caliguland && chown -R caliguland:caliguland /app
USER caliguland

EXPOSE 3000

CMD ["node", "dist/index.js"]

