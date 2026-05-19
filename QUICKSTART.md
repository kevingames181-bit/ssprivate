# SeaScope Alaska - Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Prerequisites
- Docker & Docker Compose installed
- Node.js 18+ installed
- Git installed

---

## Local Development

```bash
# 1. Clone repository
git clone https://github.com/your-org/seascope-alaska.git
cd seascope-alaska

# 2. Install dependencies
npm install
cd backend && npm install && cd ..

# 3. Setup environment variables
cp .env.example .env
cp backend/.env.example backend/.env

# 4. Get free API keys
# OpenWeatherMap: https://openweathermap.org/api (Free tier: 1,000 calls/day)
# Add to .env: VITE_OPENWEATHER_API_KEY=your_key_here

# 5. Start backend
cd backend
npm run dev

# 6. Start frontend (in new terminal)
npm run dev

# 7. Open browser
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

---

## Production Deployment (Docker)

```bash
# 1. Configure production environment
cp .env.production .env
# Edit .env with your production values

# 2. Deploy with one command
chmod +x scripts/deploy.sh
./scripts/deploy.sh production

# 3. Access application
# http://localhost (frontend)
# http://localhost:3001 (backend API)
```

---

## Production Deployment (AWS)

```bash
# 1. Setup server (Ubuntu 20.04+)
chmod +x scripts/setup-production.sh
sudo ./scripts/setup-production.sh

# 2. Configure environment
cp .env.production .env
# Edit with production values

# 3. Deploy
./scripts/deploy.sh production

# 4. Setup SSL
sudo certbot --nginx -d seascope-alaska.com

# 5. Configure DNS
# Point your domain to server IP
```

---

## Essential Environment Variables

### Required for Basic Functionality
```bash
# Weather Data (FREE)
VITE_OPENWEATHER_API_KEY=your_key_here

# Database
DATABASE_URL=postgresql://user:pass@host:5432/seascope_production

# JWT Authentication
JWT_SECRET=your_super_secure_random_string_min_64_chars
ENCRYPTION_KEY=your_32_byte_encryption_key
```

### Optional for Full Features
```bash
# Payments
STRIPE_SECRET_KEY=sk_live_your_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_key

# Monitoring
VITE_SENTRY_DSN=https://your_sentry_dsn
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Email
SENDGRID_API_KEY=SG.your_key
```

---

## Database Setup

### Using Docker (Automatic)
```bash
docker-compose up -d postgres
# Database automatically initialized with init.sql
```

### Manual Setup
```bash
# 1. Create database
createdb seascope_production

# 2. Run initialization
psql -d seascope_production -f backend/database/init.sql

# 3. Verify
psql -d seascope_production -c "\dt"
```

---

## Testing the Deployment

```bash
# Check frontend health
curl http://localhost/health

# Check backend health
curl http://localhost:3001/health

# Check database connection
docker-compose exec postgres psql -U seascope -d seascope_production -c "SELECT COUNT(*) FROM users;"

# Check Redis
docker-compose exec redis redis-cli ping
```

---

## Common Issues

### Port Already in Use
```bash
# Check what's using the port
lsof -i :3000  # Frontend
lsof -i :3001  # Backend

# Kill the process
kill -9 <PID>
```

### Docker Permission Denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### API Key Not Working
```bash
# Verify environment variables are loaded
docker-compose exec backend env | grep VITE_OPENWEATHER_API_KEY

# Restart services after changing .env
docker-compose restart
```

---

## Backup & Restore

### Create Backup
```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
# Backup saved to /var/backups/seascope/
```

### Restore Backup
```bash
chmod +x scripts/restore.sh
./scripts/restore.sh /var/backups/seascope/seascope_20260218_020000.sql.gz
```

---

## Monitoring

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100
```

### Check Resource Usage
```bash
# Container stats
docker stats

# Disk usage
docker system df

# Clean up
docker system prune -a
```

---

## Scaling

### Increase Container Resources
```yaml
# Edit docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### Add More Workers
```bash
# Scale backend service
docker-compose up -d --scale backend=3
```

---

## Security Checklist

- [ ] Change default passwords in .env
- [ ] Setup SSL certificate (certbot)
- [ ] Configure firewall (ufw)
- [ ] Enable automatic security updates
- [ ] Setup backup automation (cron)
- [ ] Configure monitoring alerts
- [ ] Review and restrict CORS origins
- [ ] Enable rate limiting
- [ ] Setup fail2ban for SSH

---

## Support

- Documentation: https://docs.seascope-alaska.com
- Email: support@seascope-alaska.com
- GitHub Issues: https://github.com/your-org/seascope-alaska/issues
- Status Page: https://status.seascope-alaska.com

---

## Next Steps

1. ✅ Get it running locally
2. ✅ Configure API keys
3. ✅ Deploy to production
4. 📊 Setup monitoring
5. 💳 Configure payments
6. 🚀 Launch!

**You're ready to go! 🎉**
