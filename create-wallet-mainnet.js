// create-wallet.js - Create and fund XRPL wallet on mainnet

const xrpl = require('xrpl');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// RLUSD Configuration
const RLUSD_CONFIG = {
    issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
    currencyCode: 'RLUSD',
    servers: [
        'wss://xrplcluster.com',
        'wss://s1.ripple.com',
        'wss://s2.ripple.com'
    ]
};

// Minimum XRP requirements
const XRP_REQUIREMENTS = {
    baseReserve: 10,        // Base reserve for account
    ownerReserve: 2,        // Per trustline/object
    minFunding: 15,         // Recommended minimum
    safeOperational: 25     // Safe operational amount
};

/**
 * Create secure XRPL client connection
 */
async function createSecureClient() {
    for (const server of RLUSD_CONFIG.servers) {
        try {
            console.log(`Connecting to ${server}...`);
            const client = new xrpl.Client(server);
            await client.connect();
            console.log(`✓ Connected to ${server}\n`);
            return client;
        } catch (error) {
            console.error(`Failed to connect to ${server}`);
        }
    }
    throw new Error('Failed to connect to any XRPL server');
}

/**
 * Generate a new XRPL wallet
 */
function generateWallet() {
    console.log('🔐 Generating new XRPL wallet...\n');
    
    const wallet = xrpl.Wallet.generate();
    
    return {
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        classicAddress: wallet.classicAddress,
        seed: wallet.seed
    };
}

/**
 * Display wallet information
 */
function displayWalletInfo(walletInfo) {
    console.log('=' * 60);
    console.log('🎉 NEW XRPL WALLET CREATED');
    console.log('=' * 60);
    console.log('\n⚠️  IMPORTANT: Save this information securely!');
    console.log('⚠️  Never share your seed or private key!\n');
    
    console.log('📋 Wallet Details:');
    console.log('-' * 40);
    console.log(`Address:     ${walletInfo.classicAddress}`);
    console.log(`Public Key:  ${walletInfo.publicKey}`);
    console.log('\n🔑 Secret Information (KEEP SECURE):');
    console.log('-' * 40);
    console.log(`Seed:        ${walletInfo.seed}`);
    console.log(`Private Key: ${walletInfo.privateKey}`);
    console.log('\n' + '=' * 60);
}

/**
 * Save wallet information to file
 */
async function saveWalletToFile(walletInfo, filename = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const walletFilename = filename || `wallet-${walletInfo.classicAddress}-${timestamp}.json`;
    const walletPath = path.join(process.cwd(), 'wallets');
    
    // Create wallets directory if it doesn't exist
    await fs.mkdir(walletPath, { recursive: true });
    
    const fullPath = path.join(walletPath, walletFilename);
    
    const walletData = {
        created: new Date().toISOString(),
        network: 'mainnet',
        ...walletInfo,
        warning: 'KEEP THIS FILE SECURE! Never share your seed or private key!'
    };
    
    await fs.writeFile(fullPath, JSON.stringify(walletData, null, 2));
    
    return fullPath;
}

/**
 * Check if account is activated
 */
async function checkAccountStatus(client, address) {
    try {
        const response = await client.request({
            command: 'account_info',
            account: address,
            ledger_index: 'validated'
        });
        
        return {
            exists: true,
            balance: xrpl.dropsToXrp(response.result.account_data.Balance),
            sequence: response.result.account_data.Sequence
        };
    } catch (error) {
        if (error.data?.error === 'actNotFound') {
            return { exists: false, balance: '0' };
        }
        throw error;
    }
}

/**
 * Wait for account to be funded
 */
async function waitForFunding(client, address, requiredXRP = XRP_REQUIREMENTS.minFunding) {
    console.log(`\n💰 Waiting for account funding...`);
    console.log(`   Please send at least ${requiredXRP} XRP to activate the account.`);
    console.log(`   Checking every 5 seconds...\n`);
    
    let attempts = 0;
    while (true) {
        attempts++;
        process.stdout.write(`   Attempt ${attempts}... `);
        
        const status = await checkAccountStatus(client, address);
        
        if (status.exists && parseFloat(status.balance) >= requiredXRP) {
            console.log(`✓ Account activated with ${status.balance} XRP!\n`);
            return status;
        } else if (status.exists) {
            console.log(`Account activated but only has ${status.balance} XRP (need ${requiredXRP})`);
        } else {
            console.log('Account not yet activated');
        }
        
        // Wait 5 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

/**
 * Setup RLUSD trustline
 */
async function setupRLUSDTrustline(client, wallet, limit = '1000000') {
    console.log('🔗 Setting up RLUSD trustline...\n');
    
    try {
        // Check if trustline already exists
        const linesResponse = await client.request({
            command: 'account_lines',
            account: wallet.classicAddress,
            peer: RLUSD_CONFIG.issuer,
            ledger_index: 'validated'
        });
        
        const existingLine = linesResponse.result.lines.find(
            line => line.currency === RLUSD_CONFIG.currencyCode
        );
        
        if (existingLine) {
            console.log('✓ RLUSD trustline already exists!');
            console.log(`  Current limit: ${existingLine.limit}`);
            console.log(`  Current balance: ${existingLine.balance} RLUSD\n`);
            return { exists: true, ...existingLine };
        }
        
        // Create trustline
        const trustSetTx = {
            TransactionType: 'TrustSet',
            Account: wallet.classicAddress,
            LimitAmount: {
                currency: RLUSD_CONFIG.currencyCode,
                issuer: RLUSD_CONFIG.issuer,
                value: limit
            }
        };
        
        const prepared = await client.autofill(trustSetTx);
        const signed = wallet.sign(prepared);
        
        console.log('📝 Submitting trustline transaction...');
        const result = await client.submitAndWait(signed.tx_blob);
        
        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            console.log('✓ RLUSD trustline created successfully!');
            console.log(`  Transaction: ${result.result.hash}`);
            console.log(`  Limit: ${limit} RLUSD`);
            console.log(`  Explorer: https://livenet.xrpl.org/transactions/${result.result.hash}\n`);
            return { exists: true, limit, balance: '0' };
        } else {
            throw new Error(`Trustline creation failed: ${result.result.meta.TransactionResult}`);
        }
    } catch (error) {
        console.error('❌ Failed to create trustline:', error.message);
        throw error;
    }
}

/**
 * Interactive wallet creation process
 */
async function interactiveWalletCreation() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const question = (query) => new Promise(resolve => rl.question(query, resolve));
    
    console.log('\n🚀 XRPL Mainnet Wallet Creator\n');
    console.log('This tool will:');
    console.log('1. Generate a new XRPL wallet');
    console.log('2. Help you activate it with XRP');
    console.log('3. Set up RLUSD trustline');
    console.log('4. Save credentials securely\n');
    
    const proceed = await question('Continue? (yes/no): ');
    if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        rl.close();
        return;
    }
    
    let client;
    try {
        // Generate wallet
        const walletInfo = generateWallet();
        const wallet = xrpl.Wallet.fromSeed(walletInfo.seed);
        
        // Display wallet info
        displayWalletInfo(walletInfo);
        
        // Save to file
        const saveToFile = await question('\nSave wallet to file? (yes/no): ');
        if (saveToFile.toLowerCase() === 'yes' || saveToFile.toLowerCase() === 'y') {
            const filepath = await saveWalletToFile(walletInfo);
            console.log(`\n✓ Wallet saved to: ${filepath}`);
            console.log('  ⚠️  Keep this file secure and make backups!\n');
        }
        
        // Connect to XRPL
        client = await createSecureClient();
        
        // Check activation options
        console.log('\n💰 Account Activation Options:');
        console.log('1. I will fund the account myself');
        console.log('2. Someone else will fund the account');
        console.log('3. Skip activation for now\n');
        
        const activationChoice = await question('Choose option (1-3): ');
        
        if (activationChoice === '3') {
            console.log('\n⚠️  Remember: Account needs at least 10 XRP to be activated.');
            console.log('   Additional 2 XRP reserve required for RLUSD trustline.\n');
        } else {
            console.log('\n📋 Funding Instructions:');
            console.log(`   Send at least ${XRP_REQUIREMENTS.minFunding} XRP to:`);
            console.log(`   ${walletInfo.classicAddress}\n`);
            console.log('   Recommended amounts:');
            console.log(`   - Minimum: ${XRP_REQUIREMENTS.minFunding} XRP (account + 1 trustline)`);
            console.log(`   - Safe:    ${XRP_REQUIREMENTS.safeOperational} XRP (with buffer for fees)\n`);
            
            const waitForFunds = await question('Wait for funding? (yes/no): ');
            
            if (waitForFunds.toLowerCase() === 'yes' || waitForFunds.toLowerCase() === 'y') {
                // Wait for funding
                const status = await waitForFunding(client, walletInfo.classicAddress);
                
                // Ask about trustline
                const setupTrustline = await question('Set up RLUSD trustline now? (yes/no): ');
                
                if (setupTrustline.toLowerCase() === 'yes' || setupTrustline.toLowerCase() === 'y') {
                    const customLimit = await question('Trustline limit (press Enter for default 1,000,000): ');
                    const limit = customLimit || '1000000';
                    
                    await setupRLUSDTrustline(client, wallet, limit);
                }
            }
        }
        
        // Final summary
        console.log('\n📊 Final Wallet Summary:');
        console.log('=' * 50);
        console.log(`Address: ${walletInfo.classicAddress}`);
        
        const finalStatus = await checkAccountStatus(client, walletInfo.classicAddress);
        if (finalStatus.exists) {
            console.log(`Status:  ✓ Active`);
            console.log(`Balance: ${finalStatus.balance} XRP`);
            
            // Check trustline
            const linesResponse = await client.request({
                command: 'account_lines',
                account: walletInfo.classicAddress,
                peer: RLUSD_CONFIG.issuer
            });
            
            const rlusdLine = linesResponse.result.lines.find(
                line => line.currency === RLUSD_CONFIG.currencyCode
            );
            
            if (rlusdLine) {
                console.log(`RLUSD:   ✓ Trustline active (${rlusdLine.balance} RLUSD)`);
            } else {
                console.log(`RLUSD:   ✗ No trustline`);
            }
        } else {
            console.log(`Status:  ✗ Not activated (needs ${XRP_REQUIREMENTS.baseReserve} XRP)`);
        }
        
        console.log('\n🔗 Useful Links:');
        console.log(`Explorer: https://livenet.xrpl.org/accounts/${walletInfo.classicAddress}`);
        console.log(`Bithomp:  https://bithomp.com/explorer/${walletInfo.classicAddress}`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    } finally {
        if (client) {
            await client.disconnect();
        }
        rl.close();
    }
}

/**
 * Quick wallet generation (non-interactive)
 */
async function quickGenerateWallet() {
    console.log('🚀 Quick Wallet Generation\n');
    
    // Generate wallet
    const walletInfo = generateWallet();
    
    // Display info
    displayWalletInfo(walletInfo);
    
    // Save to file
    const filepath = await saveWalletToFile(walletInfo);
    console.log(`\n✓ Wallet saved to: ${filepath}\n`);
    
    // Show next steps
    console.log('📋 Next Steps:');
    console.log(`1. Fund the account with at least ${XRP_REQUIREMENTS.minFunding} XRP`);
    console.log('2. Run this command to set up RLUSD trustline:');
    console.log(`   node create-wallet.js setup ${walletInfo.classicAddress}\n`);
    
    console.log('🔗 View on Explorer:');
    console.log(`   https://livenet.xrpl.org/accounts/${walletInfo.classicAddress}\n`);
}

/**
 * Setup trustline for existing wallet
 */
async function setupExistingWallet(address) {
    console.log(`\n🔧 Setting up RLUSD trustline for ${address}\n`);
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const question = (query) => new Promise(resolve => rl.question(query, resolve));
    
    let client;
    try {
        // Connect to XRPL
        client = await createSecureClient();
        
        // Check account
        const status = await checkAccountStatus(client, address);
        if (!status.exists) {
            console.log('❌ Account not found or not activated.');
            console.log(`   Please fund the account with at least ${XRP_REQUIREMENTS.baseReserve} XRP first.\n`);
            return;
        }
        
        console.log(`✓ Account found with ${status.balance} XRP\n`);
        
        // Get seed
        const seed = await question('Enter wallet seed (starts with "s"): ');
        
        if (!seed.startsWith('s')) {
            throw new Error('Invalid seed format');
        }
        
        const wallet = xrpl.Wallet.fromSeed(seed);
        
        if (wallet.classicAddress !== address) {
            throw new Error('Seed does not match the provided address');
        }
        
        // Setup trustline
        await setupRLUSDTrustline(client, wallet);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (client) {
            await client.disconnect();
        }
        rl.close();
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'quick':
            await quickGenerateWallet();
            break;
            
        case 'setup':
            if (!args[1]) {
                console.error('Usage: node create-wallet.js setup <address>');
                break;
            }
            await setupExistingWallet(args[1]);
            break;
            
        case 'help':
            console.log('\nXRPL Wallet Creator - Commands:\n');
            console.log('  node create-wallet.js          Interactive wallet creation');
            console.log('  node create-wallet.js quick    Quick wallet generation');
            console.log('  node create-wallet.js setup    <address> Set up RLUSD trustline\n');
            break;
            
        default:
            await interactiveWalletCreation();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    generateWallet,
    createSecureClient,
    checkAccountStatus,
    setupRLUSDTrustline,
    waitForFunding
};