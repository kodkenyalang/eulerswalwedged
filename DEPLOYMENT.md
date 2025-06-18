# Deployment Guide

This guide covers deploying the Wedged Platform to various environments.

## Prerequisites

- Node.js 18+ and npm
- Ethereum wallet with testnet ETH
- Infura or Alchemy API key
- Domain name (for production)

## Environment Setup

### Development
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start development server
npm start
```

### Production

#### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

#### 2. Application Deployment
```bash
# Clone repository
git clone https://github.com/your-username/wedged-platform.git
cd wedged-platform

# Install dependencies
npm install

# Build frontend
npm run build

# Set up environment
cp .env.example .env
nano .env  # Configure production values
```

#### 3. Smart Contract Deployment
```bash
# Compile contracts
npx hardhat compile

# Deploy to mainnet (or testnet)
npx hardhat run scripts/deploy.js --network mainnet

# Update .env with deployed contract addresses
```

#### 4. Process Management with PM2
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'wedged-server',
    script: 'server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    }
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

#### 5. Nginx Configuration
```nginx
# /etc/nginx/sites-available/wedged
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static files
    location / {
        root /path/to/wedged-platform/build;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/wedged /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 6. SSL Certificate with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Docker Deployment

### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build frontend
RUN npm run build

EXPOSE 8000

CMD ["node", "server/index.js"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  wedged-app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - RPC_URL=${RPC_URL}
      - EVC_ADDRESS=${EVC_ADDRESS}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - wedged-app
    restart: unless-stopped
```

## Environment Variables

### Required Variables
```env
# Network
RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
CHAIN_ID=1

# Contracts (update after deployment)
EVC_ADDRESS=0x...
EVC_INTEGRATION_ADDRESS=0x...
WEDGED_POOL_ADDRESS=0x...

# Security
JWT_SECRET=your-secure-secret
API_RATE_LIMIT=100

# Production
NODE_ENV=production
PORT=8000
```

## Health Checks

### Application Health
```bash
# Check application status
curl http://localhost:8000/api/health

# Check PM2 processes
pm2 status

# View logs
pm2 logs wedged-server
```

### Smart Contract Verification
```bash
# Verify contracts on Etherscan
npx hardhat verify --network mainnet DEPLOYED_ADDRESS "Constructor" "Arguments"
```

## Monitoring

### Log Management
```bash
# Set up log rotation
sudo nano /etc/logrotate.d/wedged

# Content:
/path/to/wedged-platform/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload wedged-server
    endscript
}
```

### Performance Monitoring
- Use PM2 Plus for application monitoring
- Set up Datadog or New Relic for infrastructure monitoring
- Configure alerts for critical metrics

## Security Checklist

- [ ] Update all dependencies to latest versions
- [ ] Configure firewall (UFW) to allow only necessary ports
- [ ] Set up fail2ban for SSH protection
- [ ] Enable automatic security updates
- [ ] Configure proper CORS origins
- [ ] Set secure headers in Nginx
- [ ] Use environment variables for all secrets
- [ ] Enable rate limiting
- [ ] Set up SSL/TLS certificates
- [ ] Configure CSP headers

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure port 8000 is available
2. **Permission errors**: Check file permissions and user ownership
3. **Memory issues**: Monitor RAM usage and adjust PM2 configuration
4. **Network connectivity**: Verify RPC endpoint accessibility
5. **Contract deployment**: Ensure sufficient gas and correct network

### Debug Commands
```bash
# Check application logs
pm2 logs wedged-server --lines 100

# Test API endpoints
curl -X GET http://localhost:8000/api/health

# Check Nginx configuration
sudo nginx -t

# Monitor system resources
htop
```

## Rollback Procedure

1. Stop the application: `pm2 stop wedged-server`
2. Restore previous version from git
3. Restore database if needed
4. Update environment variables
5. Restart application: `pm2 start wedged-server`

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Monitor logs daily
- Review security patches weekly
- Backup configuration files
- Test disaster recovery procedures quarterly