#!/bin/bash

# Generate Secure Secrets for Production
# Run this script to generate all required secrets for .env.production

echo "🔐 Generating Secure Secrets for SeaScope Alaska Production"
echo "============================================================"
echo ""

# Generate JWT Secret (64 characters)
JWT_SECRET=$(openssl rand -base64 48)
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# Generate Encryption Key (32 bytes = 44 characters base64)
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""

# Generate Session Secret
SESSION_SECRET=$(openssl rand -base64 48)
echo "SESSION_SECRET=$SESSION_SECRET"
echo ""

# Generate Database Password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "POSTGRES_PASSWORD=$DB_PASSWORD"
echo ""

# Generate Redis Password
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo ""

echo "============================================================"
echo "✅ Secrets generated successfully!"
echo ""
echo "⚠️  IMPORTANT:"
echo "1. Copy these values to your .env.production file"
echo "2. NEVER commit these secrets to version control"
echo "3. Store them securely (use AWS Secrets Manager, HashiCorp Vault, etc.)"
echo "4. Rotate these secrets regularly (every 90 days recommended)"
echo ""
echo "📝 Next steps:"
echo "1. Update .env.production with these values"
echo "2. Configure your cloud provider secrets manager"
echo "3. Update your CI/CD pipeline with encrypted secrets"
echo ""
