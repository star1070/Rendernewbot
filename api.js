const express = require('express');
const bodyParser = require('body-parser');
const { Server, TransactionBuilder, Networks, Operation, Asset, Keypair, Transaction } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static('public'));

const HORIZON_URL = 'https://api.mainnet.minepi.com';
const NETWORK_PASSPHRASE = 'Pi Network';
const server = new Server(HORIZON_URL);

function generateWalletKeypair(passphrase) {
  const seed = mnemonicToSeedSync(passphrase.toLowerCase().trim());
  const { key } = derivePath("m/44'/314159'/0'", seed.toString('hex'));
  return Keypair.fromRawEd25519Seed(key);
}

// Old endpoint for frontend compatibility
app.post('/submitTransaction', async (req, res) => {
  try {
    const { xdr } = req.body;
    if (!xdr) return res.status(400).json({ success: false, error: 'Missing signed XDR' });

    const tx = new Transaction(xdr, NETWORK_PASSPHRASE);
    const response = await server.submitTransaction(tx);

    res.json({ success: true, txHash: response.hash, result: response });
  } catch (e) {
    console.error('[API /submitTransaction Error]:', e.response?.data || e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// New endpoint for direct passphrase-based transfer
app.post('/transfer', async (req, res) => {
  try {
    const { passphrase, receiver, balanceId, amount } = req.body;
    if (!passphrase || !receiver || !balanceId || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const senderKp = generateWalletKeypair(passphrase);
    const sourceAccount = await server.loadAccount(senderKp.publicKey());

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

    tx.sign(senderKp);
    const response = await server.submitTransaction(tx);

    res.json({ success: true, txHash: response.hash, result: response });
  } catch (error) {
    console.error('[API /transfer Error]:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      reason: error.response?.data?.extras?.result_codes || 'Unknown error'
    });
  }
});

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
