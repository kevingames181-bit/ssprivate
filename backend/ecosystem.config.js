module.exports = {
  apps: [{
    name: 'seascope-backend',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: { NODE_ENV: 'production', PORT: 3001 },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    kill_timeout: 10000,
    wait_ready: true,
    listen_timeout: 10000,
  }],
};
