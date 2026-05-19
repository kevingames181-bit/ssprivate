# Multi-stage build for production
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDeps needed for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build application (VITE_ vars baked in at build time)
ARG VITE_RMIS_API_KEY=82989ef7-039e-45bc-83e5-35a9c2a8bb9c
ENV VITE_RMIS_API_KEY=$VITE_RMIS_API_KEY

RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
