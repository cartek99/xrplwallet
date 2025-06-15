# XRPL Configuration
# Your XRP Ledger wallet seed (starts with 's')
# NEVER commit this to version control!
XRPL_SEED=sYOUR_WALLET_SEED_HERE

# Server Configuration
PORT=3000
NODE_ENV=production

# Security Settings
# Generate a strong secret: openssl rand -base64 32
SESSION_SECRET=your-session-secret-here

# Optional: Basic Authentication for Web Interface
# Uncomment to enable
# BASIC_AUTH_USER=admin
# BASIC_AUTH_PASSWORD=secure-password

# RLUSD Configuration (DO NOT CHANGE for mainnet)
RLUSD_ISSUER=rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De
RLUSD_CURRENCY=RLUSD

# API Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Optional: Webhook for notifications
# WEBHOOK_URL=https://your-webhook-endpoint.com/notify

# Optional: Database for persistent storage
# DATABASE_URL=postgres://user:pass@localhost:5432/rlusd_db

# Optional: Email notifications
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# Development Settings
# Set to true for verbose logging
DEBUG=false

# XRPL Network (mainnet/testnet/devnet)
XRPL_NETWORK=mainnet

# Custom XRPL servers (optional, comma-separated)
# XRPL_SERVERS=wss://xrplcluster.com,wss://s1.ripple.com