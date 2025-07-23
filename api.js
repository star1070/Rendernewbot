const express = require('express');
const bodyParser = require('body-parser');
const { Server, TransactionBuilder, Networks, Operation, Asset, Keypair } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static('public')); // Frontend serve करेगा

// Horizon server config
const HORIZON_URL = 'https://api.mainnet.minepi.com';
const server = new Server(HORIZON_URL);
const NETWORK_PASSPHRASE = 'Pi Network';

// Passphrase से Keypair generate करने का function
function generateWalletKeypair(passphrase) {
  const seed = mnemonicToSeedSync(passphrase.toLowerCase().trim());
  const { key } = derivePath("m/44'/314159'/0'", seed.toString('hex'));
  return Keypair.fromRawEd25519Seed(key);
}

// API endpoint: Claim और transfer
app.post('/transfer', async (req, res) => {
  try {
    const { passphrase, receiver, balanceId, amount } = req.body;

    if (!passphrase || !receiver || !balanceId || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Keypair और account load
    const senderKp = generateWalletKeypair(passphrase);
    const sourceAccount = await server.loadAccount(senderKp.publicKey());

    // Transaction build
    const tx = new TransactionBuilder(sourceAccount, {
      fee: (parseInt(await server.fetchBaseFee(), 10) + 100).toString(),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(Operation.claimClaimableBalance({ balanceId }))
      .addOperation(Operation.payment({
        destination: receiver,
        asset: Asset.native(),
        amount: amount.toString(),
      }))
      .setTimeout(30)
      .build();

    // Sign और submit
    tx.sign(senderKp);
    const response = await server.submitTransaction(tx);

    res.json({ success: true, txHash: response.hash, result: response });
  } catch (error) {
    console.error('[API] Transfer Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      reason: error.response?.data?.extras?.result_codes || 'Unknown error'
    });
  }
});

// Server start
app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
