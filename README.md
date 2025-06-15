# XRPL RLUSD Transaction Manager

A comprehensive Node.js toolkit for managing RLUSD (Ripple USD) transactions on the XRP Ledger mainnet. This repository provides wallet creation, transaction handling, and a web interface for managing RLUSD operations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)
![XRPL](https://img.shields.io/badge/XRPL-Mainnet-orange.svg)

## 🚀 Features

- **Wallet Management**: Create and manage XRPL wallets with RLUSD support
- **Transaction Handler**: Send, receive, and track RLUSD transactions
- **Web Interface**: User-friendly dashboard for all operations
- **Trustline Setup**: Automated RLUSD trustline configuration
- **Transaction Logging**: Complete audit trail with CSV export
- **Real-time Balance**: Live balance checking and monitoring
- **Secure Design**: Best practices for key management

## 📋 Prerequisites

- Node.js 14.0 or higher
- npm or yarn
- XRP for account activation (minimum 10 XRP)
- Basic understanding of XRP Ledger

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/xrpl-rlusd-manager.git
cd xrpl-rlusd-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

## 🚦 Quick Start

### 1. Create a New Wallet

```bash
npm run create-wallet
```

This will:
- Generate a new XRPL wallet
- Guide you through activation
- Set up RLUSD trustline

### 2. Start the Web Interface

```bash
npm start
```

Access the dashboard at `http://localhost:3000`

### 3. Send RLUSD via CLI

```bash
npm run send -- <recipient> <amount>
```

## 📁 Project Structure

```
xrpl-rlusd-manager/
├── src/
│   ├── core/
│   │   ├── rlusd-handler.js      # Core RLUSD transaction logic
│   │   └── wallet-manager.js     # Wallet creation and management
│   ├── web/
│   │   ├── server.js            # Express API server
│   │   └── public/              # Web interface files
│   └── cli/
│       ├── create-wallet.js     # CLI wallet creator
│       └── run-rlusd.js         # CLI transaction runner
├── docs/
│   ├── API.md                   # API documentation
│   ├── SECURITY.md              # Security guidelines
│   └── DEPLOYMENT.md            # Deployment guide
├── examples/
│   └── basic-usage.js           # Usage examples
├── tests/
│   └── ...                      # Test files
├── .env.example                 # Environment template
├── package.json
└── README.md
```

## 💻 Usage Examples

### Creating a Wallet

```javascript
const { createWallet } = require('./src/core/wallet-manager');

const wallet = await createWallet();
console.log(`New wallet: ${wallet.address}`);
```

### Sending RLUSD

```javascript
const { sendRLUSD } = require('./src/core/rlusd-handler');

const result = await sendRLUSD(
    senderWallet,
    'rRecipientAddress',
    '100.50'  // Amount in RLUSD
);
```

### Checking Balance

```javascript
const { checkBalance } = require('./src/core/rlusd-handler');

const balance = await checkBalance('rYourAddress');
console.log(`Balance: ${balance} RLUSD`);
```

## 🌐 Web Interface

The web interface provides:

- **Dashboard**: View wallet info and RLUSD balance
- **Send**: Send RLUSD with address validation
- **Receive**: Display QR code and address
- **History**: Transaction logs with filtering
- **Settings**: Manage trustlines and preferences

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet` | Get wallet information |
| POST | `/api/send` | Send RLUSD transaction |
| POST | `/api/balance` | Check any address balance |
| GET | `/api/logs` | Get transaction history |
| POST | `/api/trustline` | Create RLUSD trustline |

## 🔒 Security

- **Never commit `.env` files** containing seeds
- **Use environment variables** for sensitive data
- **Enable HTTPS** in production
- **Implement authentication** for web interface
- **Regular backups** of wallet credentials

See [SECURITY.md](docs/SECURITY.md) for detailed security guidelines.

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run specific tests:

```bash
npm test -- --grep "wallet creation"
```

## 🚀 Deployment

### Using Docker

```bash
docker build -t rlusd-manager .
docker run -p 3000:3000 --env-file .env rlusd-manager
```

### Using PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

## 📊 RLUSD Information

- **Issuer**: `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`
- **Currency Code**: `RLUSD`
- **Network**: XRP Ledger Mainnet

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is provided "as is" without warranty of any kind. Use at your own risk. Always test with small amounts first and ensure you have secure backups of your wallet credentials.

## 🔗 Resources

- [XRP Ledger Documentation](https://xrpl.org)
- [RLUSD Information](https://ripple.com/solutions/crypto-liquidity/)
- [XRPL Discord Community](https://discord.gg/xrplcommunity)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/xrpl-rlusd-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/xrpl-rlusd-manager/discussions)
- **Email**: your-email@example.com

---

Made with ❤️ for the XRPL community