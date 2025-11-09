# Backend Dockerfile for Google Cloud Run
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install if package-lock.json doesn't exist)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Install dev dependencies for building TypeScript
RUN npm install --include=dev

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create data directories
# Note: database/ is already copied with COPY . . above
RUN mkdir -p data uploads database

# Expose port (Cloud Run automatically sets PORT env variable)
EXPOSE 8080

# Start the application
CMD ["node", "dist/index.js"]

