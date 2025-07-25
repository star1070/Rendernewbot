// File: netlify/functions/submitTransaction.js

// ये लाइब्रेरी आपके प्रोजेक्ट में इंस्टॉल होनी चाहिए
// टर्मिनल में चलाएँ: npm install stellar-sdk bip39 ed25519-hd-key axios
const { Keypair, Horizon, Operation, TransactionBuilder, Asset } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

// =================================================================
// यह पूरा लॉजिक आपकी Project A की फाइल से लिया गया है
// मैंने बस फंक्शन के नाम समझने लायक बना दिए हैं
// =================================================================

// Pi के API सर्वर से कनेक्ट करने के लिए सेटअप
const servers = [];
for (let i = 0; i < 10; i++) {
    const httpClient = axios.create({ timeout: 25000 + 2000 * i });
    const server = new Horizon.Server("https://api.mainnet.minepi.com", { httpClient });
    servers.push(server);
}
const getRandomServer = () => servers[Math.floor(Math.random() * servers.length)];

// की-फ्रेज (mnemonic) से की-पेयर बनाने वाला फंक्शन
const createKeypairFromMnemonic = (mnemonic) => {
    const seed = mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath("m/44'/314159'/0'", seed.toString('hex'));
    return Keypair.fromRawEd25519Seed(derivedSeed.key);
};

// ट्रांजैक्शन शुरू करने वाला मुख्य फंक्शन
const initiateTransaction = async (sponsorKeypair, senderKeypair, recipientAddress, balanceId, amount, recordsPerAttempt, customFee, useAutomaticFee, useSponsor, doClaim) => {
    const server = getRandomServer();
    recordsPerAttempt = recordsPerAttempt < 1 ? 1 : recordsPerAttempt;

    try {
        const sourceAccount = useSponsor ? sponsorKeypair.publicKey() : senderKeypair.publicKey();
        const account = await server.loadAccount(sourceAccount);
        
        let fee;
        if(useAutomaticFee) {
            fee = await server.fetchBaseFee();
        } else {
            fee = parseInt(customFee * 10000000);
        }

        const numOperations = 2 * recordsPerAttempt;
        const totalFee = (1.25 * parseInt(fee) * numOperations).toString();
        
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
                source: senderKeypair.publicKey()
            };
            tx.addOperation(Operation.payment(paymentOp));
        }

        const transaction = tx.setTimeout(doClaim ? 60 * recordsPerAttempt : 30 * recordsPerAttempt).build();

        if (useSponsor) {
            transaction.sign(sponsorKeypair);
        }
        transaction.sign(senderKeypair);

        const result = await server.submitTransaction(transaction);
        return { isSuccess: true, result };

    } catch (error) {
        console.error("Transaction failed in backend:", error.response ? error.response.data : error.message);
        return { isSuccess: false, error };
    }
};

// Netlify Function का मेन हैंडलर
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: "Method Not Allowed" })};
    }

    try {
        // फ्रंटएंड से भेजे गए डेटा को लें
        const {
            senderMnemonic,
            sponsorMnemonic,
            receiverAddress,
            claimableId,
            feeType,
            recordsPerAttempt,
            amount,
            operation,
            feeMechanism,
            customFee
        } = JSON.parse(event.body);

        // की-पेयर बनाएँ
        const senderKeypair = createKeypairFromMnemonic(senderMnemonic);
        let sponsorKeypair = null;
        if (feeType === 'SPONSOR_PAYS' && sponsorMnemonic) {
            sponsorKeypair = createKeypairFromMnemonic(sponsorMnemonic);
        }

        const useSponsor = feeType === 'SPONSOR_PAYS';
        const doClaim = operation === 'claim_and_transfer';
        const useAutomaticFee = feeMechanism === 'AUTOMATIC';

        // ट्रांजैक्शन फंक्शन को कॉल करें
        const txResult = await initiateTransaction(
            sponsorKeypair,
            senderKeypair,
            receiverAddress,
            claimableId,
            amount,
            recordsPerAttempt,
            customFee,
            useAutomaticFee,
            useSponsor,
            doClaim
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ success: txResult.isSuccess, response: txResult.isSuccess ? txResult.result : txResult.error.response.data.extras.result_codes })
        };

    } catch (error) {
        console.error("Handler Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
