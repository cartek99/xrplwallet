const xrpl = require('xrpl');

/**
 * RLUSD Mainnet Configuration
 * CRITICAL: These values are for mainnet - verify before any transaction
 */
const RLUSD_CONFIG = {
  issuer: process.env.ISSUER,
  currencyCode: process.env.CURRENCY,
  
    //  issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
   // currencyCode: 'RLUSD',
  //  currencyCode: '524C555344000000000000000000000000000000',
    // XRP Ledger Mainnet endpoints
    servers: [
        'wss://xrplcluster.com',
        'wss://s1.ripple.com',
        'wss://s2.ripple.com'
    ]
};

/**
 * Validates an XRP Ledger address
 * @param {string} address - The address to validate
 * @returns {boolean} True if valid
 */
function isValidAddress(address) {
    try {
        return xrpl.isValidAddress(address);
    } catch (error) {
        return false;
    }
}

/**
 * Validates amount format and value
 * @param {string} amount - Amount to validate
 * @returns {boolean} True if valid
 */
function isValidAmount(amount) {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0 && num <= 1000000000; // Max 1 billion for safety
}

/**
 * Creates a secure XRPL client with fallback servers
 * @returns {Promise<xrpl.Client>} Connected client
 */
async function createSecureClient() {
    let lastError;
    
    for (const server of RLUSD_CONFIG.servers) {
        try {
            console.log(`Attempting to connect to ${server}...`);
            const client = new xrpl.Client(server);
            await client.connect();
            console.log(`Successfully connected to ${server}`);
            return client;
        } catch (error) {
            console.error(`Failed to connect to ${server}:`, error.message);
            lastError = error;
        }
    }
    
    throw new Error(`Failed to connect to any XRPL server. Last error: ${lastError.message}`);
}

/**
 * Checks if an account exists and has required RLUSD trustline
 * @param {xrpl.Client} client - Connected XRPL client
 * @param {string} address - Account address to check
 * @returns {Promise<{exists: boolean, hasRLUSDTrustline: boolean, balance: string}>}
 */
async function checkAccountStatus(client, address) {
    try {
        const response = await client.request({
            command: 'account_info',
            account: address,
            ledger_index: 'validated'
        });
        
        // Check for RLUSD trustline
        const linesResponse = await client.request({
            command: 'account_lines',
            account: address,
            peer: RLUSD_CONFIG.issuer,
            ledger_index: 'validated'
        });
        
        const rlusdLine = linesResponse.result.lines.find(
            line => line.currency === RLUSD_CONFIG.currencyCode
        );
        
        return {
            exists: true,
            hasRLUSDTrustline: !!rlusdLine,
            balance: rlusdLine ? rlusdLine.balance : '0',
            trustlineLimit: rlusdLine ? rlusdLine.limit : '0'
        };
    } catch (error) {
        if (error.data?.error === 'actNotFound') {
            return { exists: false, hasRLUSDTrustline: false, balance: '0' };
        }
        throw error;
    }
}

/**
 * Creates a trustline for RLUSD
 * @param {xrpl.Client} client - Connected XRPL client
 * @param {xrpl.Wallet} wallet - Wallet to create trustline from
 * @param {string} limit - Maximum amount to trust (default: 1000000)
 * @returns {Promise<Object>} Transaction result
 */
async function createRLUSDTrustline(client, wallet, limit = '1000000') {
    console.log(`Creating RLUSD trustline for ${wallet.address}...`);
    
    const trustSetTx = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
            currency: RLUSD_CONFIG.currencyCode,
            issuer: RLUSD_CONFIG.issuer,
            value: limit
        },
        Flags: 0
    };
    
    try {
        // Prepare transaction
        const prepared = await client.autofill(trustSetTx);
        console.log('Trustline transaction prepared:', JSON.stringify(prepared, null, 2));
        
        // Sign transaction
        const signed = wallet.sign(prepared);
        console.log('Transaction signed. Hash:', signed.hash);
        
        // Submit and wait for validation
        const result = await client.submitAndWait(signed.tx_blob);
        console.log('Trustline created successfully!');
        
        return result;
    } catch (error) {
        console.error('Failed to create trustline:', error);
        throw error;
    }
}

/**
 * Sends RLUSD between accounts
 * @param {xrpl.Client} client - Connected XRPL client
 * @param {xrpl.Wallet} senderWallet - Sender's wallet
 * @param {string} destinationAddress - Recipient's address
 * @param {string} amount - Amount of RLUSD to send
 * @param {string} [destinationTag] - Optional destination tag
 * @returns {Promise<Object>} Transaction result
 */
async function sendRLUSD(client, senderWallet, destinationAddress, amount, destinationTag = null) {
    console.log(`\nPreparing to send ${amount} RLUSD from ${senderWallet.address} to ${destinationAddress}`);
    
    // Validate inputs
    if (!isValidAddress(senderWallet.address)) {
        throw new Error('Invalid sender address');
    }
    if (!isValidAddress(destinationAddress)) {
        throw new Error('Invalid destination address');
    }
    if (!isValidAmount(amount)) {
        throw new Error('Invalid amount');
    }
    
    // Check sender account
    const senderStatus = await checkAccountStatus(client, senderWallet.address);
    if (!senderStatus.exists) {
        throw new Error('Sender account does not exist on ledger');
    }
    if (!senderStatus.hasRLUSDTrustline) {
        throw new Error('Sender does not have RLUSD trustline');
    }
    if (parseFloat(senderStatus.balance) < parseFloat(amount)) {
        throw new Error(`Insufficient RLUSD balance. Available: ${senderStatus.balance}`);
    }
    
    // Check destination account
    const destStatus = await checkAccountStatus(client, destinationAddress);
    if (!destStatus.exists) {
        throw new Error('Destination account does not exist on ledger');
    }
    if (!destStatus.hasRLUSDTrustline) {
        throw new Error('Destination does not have RLUSD trustline. They must set up a trustline first.');
    }
    
    // Prepare payment transaction
    const payment = {
        TransactionType: 'Payment',
        Account: senderWallet.address,
        Destination: destinationAddress,
        Amount: {
            currency: RLUSD_CONFIG.currencyCode,
            issuer: RLUSD_CONFIG.issuer,
            value: amount
        },
        Flags: 0
    };
    
    // Add destination tag if provided
    if (destinationTag) {
        payment.DestinationTag = parseInt(destinationTag);
    }
    
    try {
        // Autofill transaction details
        const prepared = await client.autofill(payment);
        console.log('Payment transaction prepared:', JSON.stringify(prepared, null, 2));
        
        // Sign transaction
        const signed = senderWallet.sign(prepared);
        console.log('Transaction signed. Hash:', signed.hash);
        
        // Submit and wait for validation
        console.log('Submitting transaction...');
        const result = await client.submitAndWait(signed.tx_blob);
        
        // Check result
        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            console.log('✅ Payment successful!');
            console.log(`Transaction hash: ${result.result.hash}`);
            console.log(`Validated in ledger: ${result.result.ledger_index}`);
            
            // Get final balances
            const finalSenderStatus = await checkAccountStatus(client, senderWallet.address);
            const finalDestStatus = await checkAccountStatus(client, destinationAddress);
            
            console.log(`\nFinal balances:`);
            console.log(`Sender: ${finalSenderStatus.balance} RLUSD`);
            console.log(`Recipient: ${finalDestStatus.balance} RLUSD`);
        } else {
            console.error('❌ Payment failed:', result.result.meta.TransactionResult);
        }
        
        return result;
    } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
    }
}

/**
 * Gets RLUSD balance for an account
 * @param {xrpl.Client} client - Connected XRPL client
 * @param {string} address - Account address
 * @returns {Promise<string>} RLUSD balance
 */
async function getRLUSDBalance(client, address) {
    const status = await checkAccountStatus(client, address);
    return status.balance;
}

/**
 * Main example/test function
 * CRITICAL: This uses TEST wallets - replace with real wallets for production
 */
async function testRLUSDTransactions() {
    let client;
    
    try {
        // Connect to mainnet
        client = await createSecureClient();
        
        // WARNING: These are example addresses - use your real wallets
        // You must replace these with actual wallet objects
        console.log('\n⚠️  WARNING: Using test example - replace with real wallets for production!\n');
        
        // Example structure - you need to provide real wallets
        const senderWallet = {
            address: 'YOUR_SENDER_ADDRESS',
            seed: 'YOUR_SENDER_SEED', // Keep this secure!
            sign: function(tx) {
                // This would be implemented by xrpl.Wallet
                throw new Error('Replace with real wallet');
            }
        };
        
        const recipientAddress = 'YOUR_RECIPIENT_ADDRESS';
        
        console.log('Checking account statuses...');
        const senderStatus = await checkAccountStatus(client, senderWallet.address);
        const recipientStatus = await checkAccountStatus(client, recipientAddress);
        
        console.log('\nSender account:');
        console.log(`- Exists: ${senderStatus.exists}`);
        console.log(`- Has RLUSD trustline: ${senderStatus.hasRLUSDTrustline}`);
        console.log(`- RLUSD balance: ${senderStatus.balance}`);
        
        console.log('\nRecipient account:');
        console.log(`- Exists: ${recipientStatus.exists}`);
        console.log(`- Has RLUSD trustline: ${recipientStatus.hasRLUSDTrustline}`);
        console.log(`- RLUSD balance: ${recipientStatus.balance}`);
        
        // Example: Create trustline if needed
        if (!senderStatus.hasRLUSDTrustline) {
            console.log('\nSender needs RLUSD trustline. Creating...');
            await createRLUSDTrustline(client, senderWallet);
        }
        
        // Example: Send RLUSD
        if (senderStatus.hasRLUSDTrustline && recipientStatus.hasRLUSDTrustline) {
            const amountToSend = '10'; // 10 RLUSD
            console.log(`\nSending ${amountToSend} RLUSD...`);
            await sendRLUSD(client, senderWallet, recipientAddress, amountToSend);
        }
        
    } catch (error) {
        console.error('Error in test:', error);
    } finally {
        if (client) {
            await client.disconnect();
            console.log('\nDisconnected from XRPL');
        }
    }
}

/**
 * Testing Checklist for Mainnet:
 * 
 * 1. Connection Testing:
 *    - Test connection to each mainnet server
 *    - Verify fallback mechanism works
 *    - Test connection timeout handling
 * 
 * 2. Account Validation:
 *    - Test with valid mainnet addresses
 *    - Test with invalid addresses
 *    - Test with non-existent accounts
 *    - Test accounts without RLUSD trustlines
 * 
 * 3. Trustline Testing:
 *    - Create trustline with various limits
 *    - Test trustline with insufficient XRP for reserve
 *    - Verify trustline appears correctly
 * 
 * 4. Transaction Testing:
 *    - Send small test amounts first (0.1 RLUSD)
 *    - Test insufficient balance scenarios
 *    - Test with destination tags
 *    - Test transaction memo field
 *    - Verify transaction in explorer
 * 
 * 5. Error Handling:
 *    - Network disconnection during transaction
 *    - Invalid transaction parameters
 *    - Ledger not synced scenarios
 *    - Rate limiting responses
 * 
 * 6. Security Testing:
 *    - Verify seed/private key never logged
 *    - Test with read-only operations first
 *    - Implement transaction limits
 *    - Add confirmation prompts for large amounts
 */

// Export functions for use
module.exports = {
    RLUSD_CONFIG,
    createSecureClient,
    checkAccountStatus,
    createRLUSDTrustline,
    sendRLUSD,
    getRLUSDBalance,
    isValidAddress,
    isValidAmount
};

// Run test if this file is executed directly
if (require.main === module) {
    console.log('RLUSD Mainnet Transaction Handler');
    console.log('=================================');
    console.log(`Issuer: ${RLUSD_CONFIG.issuer}`);
    console.log(`Currency: ${RLUSD_CONFIG.currencyCode}`);
    console.log('\n⚠️  This is configured for MAINNET - real transactions will occur!');
    console.log('\nTo run tests, call testRLUSDTransactions() with your real wallets');
}