#!/bin/bash
# SeaScope Alaska - Production Setup Script
# This script sets up the production environment

set -e

echo "=========================================="
echo "SeaScope Alaska - Production Setup"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root or with sudo"
    exit 1
fi

# Update system
echo "Updating system packages..."
apt-get update && apt-get upgrade -y

# Install Docker
echo "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo "✓ Docker installed"
else
    echo "✓ Docker already installed"
fi

# Install Docker Compose
echo "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "✓ Docker Compose installed"
else
    echo "✓ Docker Compose already installed"
fi

# Install AWS CLI
echo "Installing AWS CLI..."
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
    echo "✓ AWS CLI installed"
else
    echo "✓ AWS CLI already installed"
fi

# Install Node.js
echo "Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    echo "✓ Node.js installed"
else
    echo "✓ Node.js already installed"
fi

# Install PostgreSQL client
echo "Installing PostgreSQL client..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql-client
    echo "✓ PostgreSQL client installed"
else
    echo "✓ PostgreSQL client already installed"
fi

# Install Nginx (optional, if not using Docker)
echo "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    echo "✓ Nginx installed"
else
    echo "✓ Nginx already installed"
fi

# Install certbot for SSL
echo "Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot python3-certbot-nginx
    echo "✓ Certbot installed"
else
    echo "✓ Certbot already installed"
fi

# Create application directory
echo "Creating application directory..."
APP_DIR="/opt/seascope"
mkdir -p $APP_DIR
cd $APP_DIR

# Create backup directory
echo "Creating backup directory..."
mkdir -p /var/backups/seascope

# Setup firewall
echo "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✓ Firewall configured"

# Setup log rotation
echo "Setting up log rotation..."
cat > /etc/logrotate.d/seascope << EOF
/var/log/seascope/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        docker-compose -f $APP_DIR/docker-compose.yml restart > /dev/null 2>&1 || true
    endscript
}
EOF
echo "✓ Log rotation configured"

# Setup cron jobs
echo "Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/scripts/backup.sh") | crontab -
(crontab -l 2>/dev/null; echo "0 0 * * 0 docker system prune -af") | crontab -
echo "✓ Cron jobs configured"

# Create systemd service (optional)
echo "Creating systemd service..."
cat > /etc/systemd/system/seascope.service << EOF
[Unit]
Description=SeaScope Alaska Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable seascope.service
echo "✓ Systemd service created"

# Display versions
echo ""
echo "=========================================="
echo "Installation Summary"
echo "=========================================="
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker-compose --version)"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "AWS CLI version: $(aws --version)"
echo "PostgreSQL client: $(psql --version)"
echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo "1. Clone your repository to $APP_DIR"
echo "2. Copy .env.production to .env and configure"
echo "3. Run: cd $APP_DIR && ./scripts/deploy.sh production"
echo "4. Setup SSL: certbot --nginx -d seascope-alaska.com"
echo "5. Configure DNS to point to this server"
echo ""
echo "Setup completed successfully!"
