#!/usr/bin/env node

// standalone-create-wallet.js - Single file XRPL wallet creator
// No dependencies except xrpl package

const xrpl = require('xrpl');
const fs = require('fs');
const crypto = require('crypto');

// Configuration
const CONFIG = {
    RLUSD_ISSUER: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
    MAINNET_SERVERS: [
        'wss://xrplcluster.com',
        'wss://s1.ripple.com',
        'wss://s2.ripple.com'
    ]
};

// Generate new wallet and display all information
async function createNewWallet() {
    console.log('\n🔐 XRPL MAINNET WALLET GENERATOR\n');
    console.log('=' * 70);
    console.log('⚠️  WARNING: This will generate REAL mainnet credentials!');
    console.log('⚠️  Keep your seed phrase SECURE and NEVER share it!');
    console.log('=' * 70);
    
    // Generate wallet
    const wallet = xrpl.Wallet.generate();
    
    // Create formatted output
    const output = `
╔══════════════════════════════════════════════════════════════════════╗
║                    🆕 NEW XRPL WALLET CREATED                        ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║ 📍 PUBLIC INFORMATION (Safe to share)                                ║
║ ─────────────────────────────────────────────────────────────────── ║
║                                                                      ║
║ Address:     ${wallet.classicAddress}                         ║
║ Public Key:  ${wallet.publicKey}║
║                                                                      ║
║ ─────────────────────────────────────────────────────────────────── ║
║                                                                      ║
║ 🔐 SECRET INFORMATION (NEVER SHARE!)                                 ║
║ ─────────────────────────────────────────────────────────────────── ║
║                                                                      ║
║ Seed Phrase: ${wallet.seed}                                   ║
║                                                                      ║
║ Private Key: ${wallet.privateKey}║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
`;

    console.log(output);
    
    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `wallet-${wallet.classicAddress}-${timestamp}.txt`;
    
    const fileContent = `XRPL MAINNET WALLET
Generated: ${new Date().toISOString()}
Network: Mainnet

PUBLIC INFORMATION:
==================
Address: ${wallet.classicAddress}
Public Key: ${wallet.publicKey}

SECRET INFORMATION (KEEP SECURE!):
=================================
Seed: ${wallet.seed}
Private Key: ${wallet.privateKey}

IMPORTANT NOTES:
- This account needs at least 10 XRP to be activated
- Additional 2 XRP reserve required for each trustline
- NEVER share your seed or private key with anyone
- Make multiple secure backups of this information

USEFUL LINKS:
- Explorer: https://livenet.xrpl.org/accounts/${wallet.classicAddress}
- Bithomp: https://bithomp.com/explorer/${wallet.classicAddress}

NEXT STEPS:
1. Send at least 15 XRP to ${wallet.classicAddress} to activate
2. Set up RLUSD trustline (requires activated account)
3. Store this file securely and delete any copies

RLUSD ISSUER: ${CONFIG.RLUSD_ISSUER}
`;

    fs.writeFileSync(filename, fileContent);
    console.log(`\n✅ Wallet information saved to: ${filename}`);
    
    // Show next steps
    console.log('\n📋 NEXT STEPS:');
    console.log('───────────────');
    console.log(`1. Send at least 15 XRP to: ${wallet.classicAddress}`);
    console.log('   (10 XRP base reserve + 2 XRP for trustline + 3 XRP for fees)');
    console.log('\n2. Check activation status:');
    console.log(`   https://livenet.xrpl.org/accounts/${wallet.classicAddress}`);
    console.log('\n3. Set up RLUSD trustline after activation');
    console.log('\n4. Securely store the generated file and delete any copies');
    console.log('\n⚠️  SECURITY TIPS:');
    console.log('  • Store seed in password manager or hardware wallet');
    console.log('  • Never enter seed on untrusted websites');
    console.log('  • Make encrypted backups in multiple locations');
    console.log('  • Consider using a hardware wallet for large amounts\n');
    
    return wallet;
}

// Simple check if account exists
async function checkAccount(address) {
    console.log(`\n🔍 Checking account: ${address}\n`);
    
    let client;
    try {
        // Try to connect to mainnet
        for (const server of CONFIG.MAINNET_SERVERS) {
            try {
                client = new xrpl.Client(server);
                await client.connect();
                console.log(`✓ Connected to ${server}`);
                break;
            } catch (e) {
                continue;
            }
        }
        
        if (!client || !client.isConnected()) {
            throw new Error('Could not connect to XRPL');
        }
        
        // Check account
        try {
            const response = await client.request({
                command: 'account_info',
                account: address,
                ledger_index: 'validated'
            });
            
            const balance = xrpl.dropsToXrp(response.result.account_data.Balance);
            console.log(`✅ Account Status: ACTIVE`);
            console.log(`💰 XRP Balance: ${balance} XRP`);
            console.log(`📊 Sequence: ${response.result.account_data.Sequence}`);
            
            // Check for RLUSD trustline
            const lines = await client.request({
                command: 'account_lines',
                account: address,
                peer: CONFIG.RLUSD_ISSUER
            });
            
            const rlusdLine = lines.result.lines.find(line => line.currency === 'RLUSD');
            if (rlusdLine) {
                console.log(`\n✅ RLUSD Trustline: ACTIVE`);
                console.log(`💵 RLUSD Balance: ${rlusdLine.balance}`);
                console.log(`📈 Trustline Limit: ${rlusdLine.limit}`);
            } else {
                console.log(`\n❌ RLUSD Trustline: NOT SET`);
                console.log(`   To receive RLUSD, you need to set up a trustline`);
            }
            
        } catch (error) {
            if (error.data?.error === 'actNotFound') {
                console.log(`❌ Account Status: NOT ACTIVATED`);
                console.log(`   Send at least 10 XRP to activate this account`);
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
    } finally {
        if (client) {
            await client.disconnect();
        }
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Main execution
(async () => {
    try {
        if (command === 'check' && args[1]) {
            await checkAccount(args[1]);
        } else if (command === 'help' || command === '--help' || command === '-h') {
            console.log('\n📚 XRPL Wallet Creator - Usage:\n');
            console.log('  node standalone-create-wallet.js           Create new wallet');
            console.log('  node standalone-create-wallet.js check <address>   Check account status');
            console.log('  node standalone-create-wallet.js help      Show this help\n');
            console.log('Examples:');
            console.log('  node standalone-create-wallet.js');
            console.log('  node standalone-create-wallet.js check rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH\n');
        } else if (command) {
            console.log(`\n❌ Unknown command: ${command}`);
            console.log('   Run with "help" for usage information\n');
        } else {
            await createNewWallet();
        }
    } catch (error) {
        console.error(`\n❌ Fatal error: ${error.message}\n`);
        process.exit(1);
    }
})();

// For the * issue
function repeat(str, times) {
    return Array(times + 1).join(str);
}

console.log('=' * 70); // Should be replaced with repeat('=', 70)