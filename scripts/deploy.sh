#!/bin/bash
# SeaScope Alaska - Production Deployment Script
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT="${1:-production}"

echo "=========================================="
echo "SeaScope Alaska Deployment"
echo "Environment: $ENVIRONMENT"
echo "=========================================="

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    echo "Loading environment variables..."
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
else
    echo "WARNING: .env.$ENVIRONMENT not found"
fi

# Check prerequisites
echo "Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "ERROR: docker-compose is required but not installed."; exit 1; }

# Pull latest code
echo "Pulling latest code..."
git pull origin main

# Build Docker images
echo "Building Docker images..."
docker-compose -f docker-compose.yml build --no-cache

# Stop existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.yml down

# Run database migrations
echo "Running database migrations..."
docker-compose -f docker-compose.yml run --rm backend npm run migrate

# Start services
echo "Starting services..."
docker-compose -f docker-compose.yml up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 10

# Check service health
echo "Checking service health..."
docker-compose -f docker-compose.yml ps

# Test frontend
echo "Testing frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✓ Frontend is healthy"
else
    echo "✗ Frontend health check failed (HTTP $FRONTEND_STATUS)"
fi

# Test backend
echo "Testing backend..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✓ Backend is healthy"
else
    echo "✗ Backend health check failed (HTTP $BACKEND_STATUS)"
fi

# Show logs
echo ""
echo "Recent logs:"
docker-compose -f docker-compose.yml logs --tail=20

echo ""
echo "=========================================="
echo "Deployment completed!"
echo "Frontend: http://localhost"
echo "Backend: http://localhost:3001"
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Restart services: docker-compose restart"
echo "  Check status: docker-compose ps"
