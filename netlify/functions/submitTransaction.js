// File: netlify/functions/submitTransaction.js

const { Keypair, Horizon, Operation, TransactionBuilder, Asset } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

const server = new Horizon.Server("https://api.mainnet.minepi.com", {
    httpClient: axios.create({ timeout: 30000 })
});

const createKeypairFromMnemonic = (mnemonic) => {
    try {
        return Keypair.fromRawEd25519Seed(derivePath("m/44'/314159'/0'", mnemonicToSeedSync(mnemonic).toString('hex')).key);
    } catch (e) {
        throw new Error("Invalid keyphrase. Please check for typos or extra spaces.");
    }
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const params = JSON.parse(event.body);
        const senderKeypair = createKeypairFromMnemonic(params.senderMnemonic);
        let sponsorKeypair = null;
        
        // Sponsor fee check
        if (params.feeType === 'SPONSOR_PAYS' && params.sponsorMnemonic) {
            sponsorKeypair = createKeypairFromMnemonic(params.sponsorMnemonic);
        }

        const sourceAccountKeypair = (params.feeType === 'SPONSOR_PAYS') ? sponsorKeypair : senderKeypair;
        const accountToLoad = await server.loadAccount(sourceAccountKeypair.publicKey());
        
        // ▼▼▼ FEE MECHANISM LOGIC ▼▼▼
        let baseFeeInStroops;
        if (params.feeMechanism === 'CUSTOM' && params.customFee) {
            // Frontend se aa rahi customFee (Pi mein) ko Stroops mein convert karna
            // 1 Pi = 10,000,000 Stroops
            baseFeeInStroops = Math.round(parseFloat(params.customFee) * 10000000).toString();
        } else {
            // Automatic ke liye network se fetch karna
            baseFeeInStroops = await server.fetchBaseFee(); 
        }
        
        const tx = new TransactionBuilder(accountToLoad, {
            fee: baseFeeInStroops, // SDK automatically isko number of operations se multiply kar dega
            networkPassphrase: "Pi Network",
        });

        // ▼▼▼ RECORDS PER ATTEMPT LOGIC ▼▼▼
        const attempts = params.recordsPerAttempt ? parseInt(params.recordsPerAttempt) : 1;

        // 1. Claim Operation: Ek transaction mein lock sirf ek baar claim hoga
        if (params.operation === 'claim_and_transfer') {
            tx.addOperation(Operation.claimClaimableBalance({
                balanceId: params.claimableId,
                source: senderKeypair.publicKey()
            }));
        }
        
        // 2. Payment Operation: Ye "Records Per Attempt" ke hisaab se loop hoga
        for (let i = 0; i < attempts; i++) {
            tx.addOperation(Operation.payment({
                destination: params.receiverAddress,
                asset: Asset.native(),
                amount: params.amount.toString(),
                source: senderKeypair.publicKey()
            }));
        }

        const transaction = tx.setTimeout(60).build();
        
        // ▼▼▼ SIGNATURES ▼▼▼
        transaction.sign(senderKeypair);
        if (params.feeType === 'SPONSOR_PAYS') {
            transaction.sign(sponsorKeypair);
        }
        
        const result = await server.submitTransaction(transaction);

        if (result && result.hash) {
             return { statusCode: 200, body: JSON.stringify({ success: true, response: result }) };
        } else {
            throw new Error("Transaction was submitted but no hash was returned.");
        }

    } catch (error) {
        console.error("Error in submitTransaction:", error);
        let detailedError = "An unknown error occurred during transaction.";
        
        if (error.response?.data?.extras?.result_codes) {
            detailedError = "Transaction Failed: " + JSON.stringify(error.response.data.extras.result_codes);
        } else if (error.response?.status === 404) {
            detailedError = "The sender or sponsor account was not found on the Pi network.";
        } else if (error.message.toLowerCase().includes('timeout')) {
            detailedError = "Request to Pi network timed out. The network may be busy.";
        } else {
            detailedError = error.message;
        }

        return {
            statusCode: 200, // Status 200 rakha hai taaki frontend par error message UI toast mein dikhe
            body: JSON.stringify({ success: false, error: detailedError })
        };
    }
};
