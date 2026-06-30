FROM node:20-alpine

# Install build dependencies for compiling better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY src/ ./src/
COPY public/ ./public/

# Expose server port
EXPOSE 3000

# Start application
CMD ["node", "src/index.js"]
