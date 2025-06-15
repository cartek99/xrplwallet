// server.js - Updated with configuration endpoints

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const xrpl = require('xrpl');
const { 
    createSecureClient,
    checkAccountStatus,
    createRLUSDTrustline,
    sendRLUSD,
    getRLUSDBalance,
    isValidAddress,
    isValidAmount
} = require('./rlusd-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create logs directory if it doesn't exist
const LOGS_DIR = path.join(__dirname, 'logs');
fs.mkdir(LOGS_DIR, { recursive: true }).catch(console.error);

// Configuration storage (in production, use a database)
let config = {
    issuer: process.env.ISSUER || 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
    currencyCode: 'RLUSD',
    currencyHex: process.env.CURRENCY || '524C555344000000000000000000000000000000',
    walletAddress: '',
    hasWallet: false,
    isTestMode: process.env.NODE_ENV !== 'production'
};

// Transaction logs storage
let transactionLogs = [];

// Session-based wallet storage (in production, use secure session management)
let sessionWallet = null;

/**
 * Initialize wallet from seed
 */
function initializeWallet(seed) {
    try {
        if (!seed || !seed.startsWith('s')) {
            throw new Error('Invalid seed format');
        }
        const wallet = xrpl.Wallet.fromSeed(seed);
        sessionWallet = wallet;
        config.walletAddress = wallet.address;
        config.hasWallet = true;
        return wallet;
    } catch (error) {
        throw new Error('Failed to initialize wallet: ' + error.message);
    }
}

// Initialize wallet if seed is provided
if (process.env.XRPL_SEED) {
    try {
        initializeWallet(process.env.XRPL_SEED);
        console.log('Wallet initialized from environment');
    } catch (error) {
        console.error('Failed to initialize wallet from environment:', error.message);
    }
}

/**
 * Get current configuration (never expose seed)
 */
function getSafeConfig() {
    return {
        issuer: config.issuer,
        currencyCode: config.currencyCode,
        currencyHex: config.currencyHex,
        walletAddress: config.walletAddress,
        hasWallet: config.hasWallet,
        isTestMode: config.isTestMode,
        network: 'mainnet'
    };
}

/**
 * Update RLUSD handler configuration
 */
function updateHandlerConfig() {
    // Update the RLUSD_CONFIG in your handler
    if (global.RLUSD_CONFIG) {
        global.RLUSD_CONFIG.issuer = config.issuer;
        global.RLUSD_CONFIG.currencyCode = config.currencyCode;
    }
}

/**
 * Log transaction to file and memory
 */
async function logTransaction(type, details, success = true) {
    const logEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type,
        success,
        config: {
            issuer: config.issuer,
            currency: config.currencyCode
        },
        ...details
    };
    
    transactionLogs.unshift(logEntry);
    if (transactionLogs.length > 100) {
        transactionLogs = transactionLogs.slice(0, 100);
    }
    
    const filename = `${logEntry.timestamp.split('T')[0]}-transactions.json`;
    const filepath = path.join(LOGS_DIR, filename);
    
    try {
        let dailyLogs = [];
        try {
            const existing = await fs.readFile(filepath, 'utf8');
            dailyLogs = JSON.parse(existing);
        } catch (e) {
            // File doesn't exist yet
        }
        
        dailyLogs.push(logEntry);
        await fs.writeFile(filepath, JSON.stringify(dailyLogs, null, 2));
    } catch (error) {
        console.error('Failed to write log file:', error);
    }
    
    return logEntry;
}

// API Routes

/**
 * GET /api/config
 * Get current configuration
 */
app.get('/api/config', (req, res) => {
    res.json(getSafeConfig());
});

/**
 * POST /api/config
 * Update configuration
 */
app.post('/api/config', async (req, res) => {
    try {
        const { issuer, currencyCode, currencyHex, walletSeed } = req.body;
        
        // Validate issuer if provided
        if (issuer) {
            if (!isValidAddress(issuer)) {
                return res.status(400).json({ error: 'Invalid issuer address' });
            }
            config.issuer = issuer;
        }
        
        // Update currency if provided
        if (currencyCode) {
            config.currencyCode = currencyCode;
        }
        
        if (currencyHex) {
            // Validate hex format (40 characters)
            if (!/^[0-9A-F]{40}$/i.test(currencyHex)) {
                return res.status(400).json({ error: 'Invalid currency hex (must be 40 hex characters)' });
            }
            config.currencyHex = currencyHex;
        }
        
        // Update wallet if seed provided
        if (walletSeed) {
            try {
                const wallet = initializeWallet(walletSeed);
                
                // Test the wallet by checking its status
                const client = await createSecureClient();
                try {
                    const status = await checkAccountStatus(client, wallet.address);
                    if (!status.exists) {
                        return res.status(400).json({ 
                            error: 'Wallet not activated. Send at least 10 XRP to activate.',
                            address: wallet.address 
                        });
                    }
                } finally {
                    await client.disconnect();
                }
            } catch (error) {
                return res.status(400).json({ error: error.message });
            }
        }
        
        // Update handler configuration
        updateHandlerConfig();
        
        // Log configuration change
        await logTransaction('config_update', {
            changes: { issuer, currencyCode, currencyHex, hasWallet: !!walletSeed }
        });
        
        res.json({
            success: true,
            config: getSafeConfig()
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/config/test-connection
 * Test wallet connection
 */
app.post('/api/config/test-connection', async (req, res) => {
    const { walletSeed } = req.body;
    
    if (!walletSeed) {
        return res.status(400).json({ error: 'Wallet seed required' });
    }
    
    let client;
    try {
        // Test wallet creation
        const testWallet = xrpl.Wallet.fromSeed(walletSeed);
        
        // Test connection
        client = await createSecureClient();
        
        // Check account status
        const status = await checkAccountStatus(client, testWallet.address);
        
        res.json({
            success: true,
            address: testWallet.address,
            exists: status.exists,
            balance: status.balance || '0',
            hasRLUSDTrustline: status.hasRLUSDTrustline || false
        });
        
    } catch (error) {
        res.status(400).json({ error: error.message });
    } finally {
        if (client) {
            await client.disconnect();
        }
    }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        hasWallet: config.hasWallet,
        config: {
            issuer: config.issuer,
            currency: config.currencyCode
        }
    });
});

/**
 * GET /api/wallet
 * Get wallet information
 */
app.get('/api/wallet', async (req, res) => {
    try {
        if (!sessionWallet) {
            return res.status(400).json({ error: 'No wallet configured' });
        }
        
        const client = await createSecureClient();
        
        try {
            const status = await checkAccountStatus(client, sessionWallet.address);
            res.json({
                address: sessionWallet.address,
                ...status,
                issuer: config.issuer,
                currency: config.currencyCode
            });
        } finally {
            await client.disconnect();
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/balance
 * Check balance for any address
 */
app.post('/api/balance', async (req, res) => {
    const { address } = req.body;
    
    if (!isValidAddress(address)) {
        return res.status(400).json({ error: 'Invalid address' });
    }
    
    const client = await createSecureClient();
    try {
        // For the configured currency
        const status = await checkAccountStatus(client, address);
        
        // Check for the configured currency trustline
        if (status.exists) {
            const linesResponse = await client.request({
                command: 'account_lines',
                account: address,
                peer: config.issuer,
                ledger_index: 'validated'
            });
            
            const currencyLine = linesResponse.result.lines.find(
                line => line.currency === config.currencyCode
            );
            
            if (currencyLine) {
                status.balance = currencyLine.balance;
                status.hasTrustline = true;
                status.trustlineLimit = currencyLine.limit;
            } else {
                status.balance = '0';
                status.hasTrustline = false;
            }
        }
        
        await logTransaction('balance_check', { address, balance: status.balance });
        
        res.json({ 
            address, 
            ...status,
            currency: config.currencyCode,
            issuer: config.issuer
        });
    } catch (error) {
        await logTransaction('balance_check', { address, error: error.message }, false);
        res.status(500).json({ error: error.message });
    } finally {
        await client.disconnect();
    }
});

/**
 * POST /api/trustline
 * Create trustline for configured currency
 */
app.post('/api/trustline', async (req, res) => {
    const { limit = '1000000' } = req.body;
    
    if (!sessionWallet) {
        return res.status(400).json({ error: 'No wallet configured' });
    }
    
    const client = await createSecureClient();
    try {
        // Check if trustline already exists
        const status = await checkAccountStatus(client, sessionWallet.address);
        
        const trustSetTx = {
            TransactionType: 'TrustSet',
            Account: sessionWallet.address,
            LimitAmount: {
                currency: config.currencyCode,
                issuer: config.issuer,
                value: limit
            }
        };
        
        const prepared = await client.autofill(trustSetTx);
        const signed = sessionWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        
        await logTransaction('create_trustline', {
            address: sessionWallet.address,
            currency: config.currencyCode,
            issuer: config.issuer,
            limit,
            hash: result.result.hash,
            ledger: result.result.ledger_index
        });
        
        res.json({
            success: true,
            hash: result.result.hash,
            ledger: result.result.ledger_index,
            limit,
            currency: config.currencyCode,
            issuer: config.issuer
        });
    } catch (error) {
        await logTransaction('create_trustline', { 
            error: error.message,
            limit,
            currency: config.currencyCode
        }, false);
        res.status(500).json({ error: error.message });
    } finally {
        await client.disconnect();
    }
});

/**
 * POST /api/send
 * Send configured currency to another address
 */
app.post('/api/send', async (req, res) => {
    const { destination, amount, destinationTag } = req.body;
    
    if (!sessionWallet) {
        return res.status(400).json({ error: 'No wallet configured' });
    }
    
    if (!isValidAddress(destination)) {
        return res.status(400).json({ error: 'Invalid destination address' });
    }
    
    if (!isValidAmount(amount)) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (parseFloat(amount) > 1000) {
        return res.status(400).json({ 
            error: 'Amount exceeds safety limit of 1000. Use CLI for larger amounts.' 
        });
    }
    
    const client = await createSecureClient();
    try {
        // Create payment transaction
        const payment = {
            TransactionType: 'Payment',
            Account: sessionWallet.address,
            Destination: destination,
            Amount: {
                currency: config.currencyCode,
                issuer: config.issuer,
                value: amount
            }
        };
        
        if (destinationTag) {
            payment.DestinationTag = parseInt(destinationTag);
        }
        
        const prepared = await client.autofill(payment);
        const signed = sessionWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        
        const logEntry = await logTransaction('send_payment', {
            from: sessionWallet.address,
            to: destination,
            amount,
            currency: config.currencyCode,
            issuer: config.issuer,
            destinationTag,
            hash: result.result.hash,
            ledger: result.result.ledger_index,
            fee: result.result.Fee,
            result: result.result.meta.TransactionResult
        });
        
        res.json({
            success: true,
            hash: result.result.hash,
            ledger: result.result.ledger_index,
            explorerUrl: `https://livenet.xrpl.org/transactions/${result.result.hash}`,
            log: logEntry
        });
    } catch (error) {
        await logTransaction('send_payment', {
            from: sessionWallet.address,
            to: destination,
            amount,
            currency: config.currencyCode,
            error: error.message
        }, false);
        res.status(500).json({ error: error.message });
    } finally {
        await client.disconnect();
    }
});

// ... (keep all other existing endpoints like /api/logs, etc.)
/**
 * GET /api/logs
 * Get transaction logs
 */
app.get('/api/logs', async (req, res) => {
    const { limit = 50, type, date } = req.query;
    
    try {
        let logs = transactionLogs;
        
        // Filter by type if specified
        if (type) {
            logs = logs.filter(log => log.type === type);
        }
        
        // Filter by date if specified
        if (date) {
            logs = logs.filter(log => log.timestamp.startsWith(date));
        }
        
        // Apply limit
        logs = logs.slice(0, parseInt(limit));
        
        res.json({ logs, total: logs.length });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/logs/export
 * Export logs as CSV
 */
app.get('/api/logs/export', async (req, res) => {
    try {
        const csv = [
            'Timestamp,Type,Success,From,To,Amount,Currency,Hash,Error',
            ...transactionLogs.map(log => [
                log.timestamp,
                log.type,
                log.success,
                log.from || '',
                log.to || '',
                log.amount || '',
                log.currency || currentConfig.currencyCode || '',
                log.hash || '',
                log.error || ''
            ].join(','))
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=xrpl-transactions.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting logs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/validate
 * Validate an address
 */
app.post('/api/validate', async (req, res) => {
    const { address } = req.body;
    
    if (!address) {
        return res.status(400).json({ error: 'Address required' });
    }
    
    const isValid = isValidAddress(address);
    res.json({ 
        address, 
        isValid,
        message: isValid ? 'Valid XRP Ledger address' : 'Invalid address format' 
    });
});

// Start server
async function startServer() {
    // Load historical logs
    try {
        const files = await fs.readdir(LOGS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        for (const file of jsonFiles.slice(-7)) {
            try {
                const content = await fs.readFile(path.join(LOGS_DIR, file), 'utf8');
                const logs = JSON.parse(content);
                transactionLogs.push(...logs);
            } catch (e) {
                console.error(`Failed to load ${file}:`, e.message);
            }
        }
        
        transactionLogs.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        transactionLogs = transactionLogs.slice(0, 100);
        
        console.log(`Loaded ${transactionLogs.length} historical logs`);
    } catch (error) {
        console.error('Failed to load historical logs:', error);
    }
    
    app.listen(PORT, () => {
        console.log(`\n🚀 RLUSD Web Interface running on http://localhost:${PORT}`);
        console.log('\nCurrent Configuration:');
        console.log(`  Issuer: ${config.issuer}`);
        console.log(`  Currency: ${config.currencyCode}`);
        console.log(`  Wallet: ${config.hasWallet ? config.walletAddress : 'Not configured'}`);
        console.log('\nAPI Endpoints:');
        console.log('  GET  /api/config        - Get configuration');
        console.log('  POST /api/config        - Update configuration');
        console.log('  POST /api/config/test   - Test wallet connection');
        console.log('  GET  /api/health        - Health check');
        console.log('  GET  /api/wallet        - Get wallet info');
        console.log('  POST /api/balance       - Check any address balance');
        console.log('  POST /api/trustline     - Create RLUSD trustline');
        console.log('  POST /api/send          - Send RLUSD');
        console.log('  GET  /api/logs          - View transaction logs');
        console.log('  GET  /api/logs/export   - Export logs as CSV');
        console.log('  POST /api/validate      - Validate an address\n');
    });
}

process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});

startServer().catch(console.error);