// File: netlify/functions/submitTransaction.js (Updated & Corrected Version)

const { Keypair, Horizon, Operation, TransactionBuilder, Asset } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

const servers = [];
for (let i = 0; i < 10; i++) {
    const httpClient = axios.create({ timeout: 25000 + 2000 * i });
    const server = new Horizon.Server("https://api.mainnet.minepi.com", { httpClient });
    servers.push(server);
}
const getRandomServer = () => servers[Math.floor(Math.random() * servers.length)];

const createKeypairFromMnemonic = (mnemonic) => {
    const seed = mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath("m/44'/314159'/0'", seed.toString('hex'));
    return Keypair.fromRawEd25519Seed(derivedSeed.key);
};

const initiateTransaction = async (sponsorKeypair, senderKeypair, recipientAddress, balanceId, amount, recordsPerAttempt, customFee, useAutomaticFee, useSponsor, doClaim) => {
    const server = getRandomServer();
    recordsPerAttempt = recordsPerAttempt < 1 ? 1 : recordsPerAttempt;

    try {
        const sourcePublicKey = useSponsor ? sponsorKeypair.publicKey() : senderKeypair.publicKey();
        const account = await server.loadAccount(sourcePublicKey);
        
        let fee;
        if(useAutomaticFee) {
            fee = await server.fetchBaseFee();
        } else {
            fee = parseInt(customFee * 10000000);
        }

        const numOperations = doClaim ? 2 * recordsPerAttempt : 1 * recordsPerAttempt;
        const totalFee = (parseInt(fee) * numOperations).toString();
        
        const tx = new TransactionBuilder(account, {
            fee: totalFee,
            networkPassphrase: "Pi Network",
        });

        for (let i = 0; i < recordsPerAttempt; i++) {
            if (doClaim) {
                tx.addOperation(Operation.claimClaimableBalance({
                    balanceId: balanceId,
                    source: senderKeypair.publicKey()
                }));
            }
            const paymentOp = {
                destination: recipientAddress,
                asset: Asset.native(),
                amount: amount.toString(),
                source: doClaim || useSponsor ? senderKeypair.publicKey() : undefined
            };
            tx.addOperation(Operation.payment(paymentOp));
        }

        const transaction = tx.setTimeout(60).build();

        if (useSponsor) {
            transaction.sign(sponsorKeypair);
        }
        transaction.sign(senderKeypair);

        const result = await server.submitTransaction(transaction);
        return { isSuccess: true, result };

    } catch (error) {
        return { isSuccess: false, error };
    }
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: "Method Not Allowed" })};
    }

    try {
        const params = JSON.parse(event.body);
        const senderKeypair = createKeypairFromMnemonic(params.senderMnemonic);
        let sponsorKeypair = null;
        if (params.feeType === 'SPONSOR_PAYS' && params.sponsorMnemonic) {
            sponsorKeypair = createKeypairFromMnemonic(params.sponsorMnemonic);
        }

        const txResult = await initiateTransaction(
            sponsorKeypair,
            senderKeypair,
            params.receiverAddress,
            params.claimableId,
            params.amount,
            params.recordsPerAttempt,
            params.customFee,
            params.feeMechanism === 'AUTOMATIC',
            params.feeType === 'SPONSOR_PAYS',
            params.operation === 'claim_and_transfer'
        );

        // ▼▼▼ यहाँ हमने लॉजिक को ठीक किया है ▼▼▼
        const isTrulySuccessful = txResult.isSuccess && txResult.result && txResult.result.hash;

        if (isTrulySuccessful) {
            // असली सफलता तभी भेजें जब हैश मिला हो
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, response: txResult.result })
            };
        } else {
            // वरना, विफलता का कारण भेजें
            const errorDetails = txResult.error?.response?.data?.extras?.result_codes || txResult.error?.message || "Unknown transaction error";
            return {
                statusCode: 200, // हम 200 भेज रहे हैं क्योंकि यह सर्वर एरर नहीं है, बल्कि ट्रांजैक्शन एरर है
                body: JSON.stringify({ success: false, error: errorDetails })
            };
        }

    } catch (error) {
        // यह तब चलेगा जब कोड में ही कोई और बड़ी गलती हो
        console.error("Critical Handler Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: "A critical error occurred in the backend function." })
        };
    }
};
