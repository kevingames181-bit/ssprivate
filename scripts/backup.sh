#!/bin/bash
# SeaScope Alaska - Database Backup Script
# Run daily via cron: 0 2 * * * /path/to/backup.sh

set -e

# Configuration
BACKUP_DIR="/var/backups/seascope"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=30

# Database credentials (use environment variables in production)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-seascope_production}"
DB_USER="${DB_USER:-seascope}"

# S3 configuration (optional)
S3_BUCKET="${S3_BUCKET:-seascope-backups}"
AWS_REGION="${AWS_REGION:-us-west-2}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup filename
BACKUP_FILE="$BACKUP_DIR/seascope_${TIMESTAMP}.sql.gz"

echo "Starting backup at $(date)"

# Create PostgreSQL backup
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-acl \
    | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup created successfully: $BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup size: $BACKUP_SIZE"
else
    echo "ERROR: Backup failed!"
    exit 1
fi

# Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ]; then
    echo "Uploading backup to S3..."
    aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/database/" \
        --region "$AWS_REGION" \
        --storage-class STANDARD_IA
    
    if [ $? -eq 0 ]; then
        echo "Backup uploaded to S3 successfully"
    else
        echo "WARNING: S3 upload failed, but local backup exists"
    fi
fi

# Remove old backups (older than RETENTION_DAYS)
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "seascope_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "seascope_*.sql.gz" -type f | wc -l)
echo "Total backups retained: $BACKUP_COUNT"

echo "Backup completed at $(date)"

# Send notification (optional - requires mail or slack webhook)
# echo "Database backup completed: $BACKUP_FILE ($BACKUP_SIZE)" | mail -s "SeaScope Backup Success" admin@seascope-alaska.com
