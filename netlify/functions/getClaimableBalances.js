// File: netlify/functions/getClaimableBalances.js

const { Keypair, Horizon } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

// Helper functions (पहले की तरह)
const servers = [];
for (let i = 0; i < 5; i++) {
    const server = new Horizon.Server("https://api.mainnet.minepi.com", {
        httpClient: axios.create({ timeout: 20000 })
    });
    servers.push(server);
}
const getRandomServer = () => servers[Math.floor(Math.random() * servers.length)];

const createKeypairFromMnemonic = (mnemonic) => {
    const seed = mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath("m/44'/314159'/0'", seed.toString('hex'));
    return Keypair.fromRawEd25519Seed(derivedSeed.key);
};

// Main handler for this function
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { mnemonic } = JSON.parse(event.body);
        if (!mnemonic) {
            return { statusCode: 400, body: JSON.stringify({ message: "Mnemonic is required." }) };
        }

        const keypair = createKeypairFromMnemonic(mnemonic);
        const publicKey = keypair.publicKey();
        const server = getRandomServer();

        const response = await server.claimableBalances().claimant(publicKey).limit(100).call();
        
        const balances = response.records.map(record => ({
            id: record.id,
            amount: record.amount,
            asset: "PI"
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, balances: balances, publicKey: publicKey })
        };

    } catch (error) {
        console.error("Error fetching claimable balances:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: "Could not fetch balances. The account might not exist or there's a network issue." })
        };
    }
};
