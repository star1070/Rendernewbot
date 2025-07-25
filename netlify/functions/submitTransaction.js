// File: netlify/functions/submitTransaction.js (Final Version)

const { Keypair, Horizon, Operation, TransactionBuilder, Asset } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

const server = new Horizon.Server("https://api.mainnet.minepi.com", {
    httpClient: axios.create({ timeout: 30000 }) // टाइमआउट 30 सेकंड कर दिया है
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
        if (params.feeType === 'SPONSOR_PAYS' && params.sponsorMnemonic) {
            sponsorKeypair = createKeypairFromMnemonic(params.sponsorMnemonic);
        }

        // ▼▼▼ अकाउंट और फीस की जानकारी यहाँ लोड हो रही है ▼▼▼
        const sourceAccountKeypair = (params.feeType === 'SPONSOR_PAYS') ? sponsorKeypair : senderKeypair;
        const accountToLoad = await server.loadAccount(sourceAccountKeypair.publicKey());
        const fee = await server.fetchBaseFee();
        
        const tx = new TransactionBuilder(accountToLoad, {
            fee,
            networkPassphrase: "Pi Network",
        });

        if (params.operation === 'claim_and_transfer') {
            tx.addOperation(Operation.claimClaimableBalance({
                balanceId: params.claimableId,
                source: senderKeypair.publicKey()
            }));
        }
        
        tx.addOperation(Operation.payment({
            destination: params.receiverAddress,
            asset: Asset.native(),
            amount: params.amount.toString(),
            source: senderKeypair.publicKey()
        }));

        const transaction = tx.setTimeout(60).build();
        transaction.sign(senderKeypair);
        if (params.feeType === 'SPONSOR_PAYS') {
            transaction.sign(sponsorKeypair);
        }
        
        const result = await server.submitTransaction(transaction);

        // असली सफलता तभी है जब हैश मिले
        if (result && result.hash) {
             return { statusCode: 200, body: JSON.stringify({ success: true, response: result }) };
        } else {
            throw new Error("Transaction was submitted but no hash was returned.");
        }

    } catch (error) {
        // ▼▼▼ मजबूत एरर हैंडलिंग ▼▼▼
        console.error("Error in submitTransaction:", error);
        let detailedError = "An unknown error occurred during transaction.";
        
        if (error.response && error.response.data && error.response.data.extras && error.response.data.extras.result_codes) {
            detailedError = "Transaction Failed: " + JSON.stringify(error.response.data.extras.result_codes);
        } else if (error.response && error.response.status === 404) {
            detailedError = "The sender or sponsor account was not found on the Pi network.";
        } else if (error.message.toLowerCase().includes('timeout')) {
            detailedError = "Request to Pi network timed out. The network may be busy. Please try again.";
        } else {
            detailedError = error.message;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: false, error: detailedError })
        };
    }
};
