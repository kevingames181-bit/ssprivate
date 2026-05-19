#!/bin/bash

# Production Readiness Checker
# Validates that all required configuration is in place

echo "🔍 Checking Production Readiness for SeaScope Alaska"
echo "===================================================="
echo ""

ERRORS=0
WARNINGS=0

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ ERROR: .env.production file not found"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ .env.production file exists"
fi

# Load environment variables
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Check critical environment variables
echo ""
echo "Checking Environment Variables:"
echo "--------------------------------"

check_var() {
    local var_name=$1
    local var_value=${!var_name}
    local is_critical=$2
    
    if [ -z "$var_value" ] || [ "$var_value" == "your_"* ] || [ "$var_value" == "YOUR_"* ]; then
        if [ "$is_critical" == "critical" ]; then
            echo "❌ CRITICAL: $var_name is not set or using placeholder"
            ERRORS=$((ERRORS + 1))
        else
            echo "⚠️  WARNING: $var_name is not set or using placeholder"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo "✅ $var_name is configured"
    fi
}

# Critical variables
check_var "DATABASE_URL" "critical"
check_var "JWT_SECRET" "critical"
check_var "ENCRYPTION_KEY" "critical"
check_var "VITE_API_URL" "critical"
check_var "CORS_ORIGIN" "critical"

# Important variables
check_var "REDIS_URL" "warning"
check_var "VITE_OPENWEATHER_API_KEY" "warning"
check_var "STRIPE_SECRET_KEY" "warning"
check_var "VITE_STRIPE_PUBLISHABLE_KEY" "warning"
check_var "SENDGRID_API_KEY" "warning"
check_var "VITE_SENTRY_DSN" "warning"

# Check Node.js version
echo ""
echo "Checking System Requirements:"
echo "-----------------------------"

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ ERROR: Node.js version must be 18 or higher (current: $(node -v))"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Node.js version: $(node -v)"
fi

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo "⚠️  WARNING: node_modules not found. Run 'npm install'"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ Dependencies installed"
fi

# Check if build directory exists
if [ ! -d "dist" ]; then
    echo "⚠️  WARNING: dist directory not found. Run 'npm run build'"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ Build directory exists"
fi

# Check Docker
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed: $(docker --version)"
else
    echo "⚠️  WARNING: Docker is not installed"
    WARNINGS=$((WARNINGS + 1))
fi

# Check SSL certificates (if nginx.conf exists)
echo ""
echo "Checking SSL Configuration:"
echo "---------------------------"

if [ -f "nginx.conf" ]; then
    if grep -q "ssl_certificate" nginx.conf; then
        echo "✅ SSL configuration found in nginx.conf"
    else
        echo "⚠️  WARNING: No SSL configuration in nginx.conf"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# Check database migrations
echo ""
echo "Checking Database:"
echo "------------------"

if [ -d "backend/database/migrations" ]; then
    MIGRATION_COUNT=$(ls -1 backend/database/migrations/*.sql 2>/dev/null | wc -l)
    echo "✅ Found $MIGRATION_COUNT database migration(s)"
else
    echo "⚠️  WARNING: No database migrations found"
    WARNINGS=$((WARNINGS + 1))
fi

# Check test coverage
echo ""
echo "Checking Tests:"
echo "---------------"

if [ -f "jest.config.js" ]; then
    echo "✅ Jest configuration found"
    
    if [ -d "src/__tests__" ]; then
        TEST_COUNT=$(find src/__tests__ -name "*.test.tsx" -o -name "*.test.ts" | wc -l)
        echo "✅ Found $TEST_COUNT test file(s)"
    else
        echo "⚠️  WARNING: No test files found"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "⚠️  WARNING: Jest not configured"
    WARNINGS=$((WARNINGS + 1))
fi

# Check security headers
echo ""
echo "Checking Security:"
echo "------------------"

if grep -q "helmet" backend/src/server.ts; then
    echo "✅ Helmet security middleware configured"
else
    echo "❌ ERROR: Helmet security middleware not found"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "rateLimit" backend/src/server.ts; then
    echo "✅ Rate limiting configured"
else
    echo "❌ ERROR: Rate limiting not configured"
    ERRORS=$((ERRORS + 1))
fi

# Check monitoring
echo ""
echo "Checking Monitoring:"
echo "--------------------"

if [ -f "src/services/monitoring.ts" ]; then
    echo "✅ Monitoring service exists"
else
    echo "⚠️  WARNING: Monitoring service not found"
    WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "===================================================="
echo "📊 Production Readiness Summary"
echo "===================================================="
echo ""
echo "❌ Critical Errors: $ERRORS"
echo "⚠️  Warnings: $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ ✅ ✅ ALL CHECKS PASSED! ✅ ✅ ✅"
    echo ""
    echo "🚀 Your application is ready for production deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Run 'npm run build' to create production build"
    echo "2. Run 'npm test' to verify all tests pass"
    echo "3. Deploy using './scripts/deploy.sh production'"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  WARNINGS FOUND - Review before deploying"
    echo ""
    echo "Your application can be deployed but has some warnings."
    echo "Review the warnings above and fix if necessary."
    echo ""
    exit 0
else
    echo "❌ ❌ ❌ NOT READY FOR PRODUCTION ❌ ❌ ❌"
    echo ""
    echo "Critical errors must be fixed before deployment!"
    echo "Review the errors above and fix them."
    echo ""
    echo "For help, see:"
    echo "- PRODUCTION_READINESS.md"
    echo "- PRODUCTION_DEPLOYMENT.md"
    echo ""
    exit 1
fi
