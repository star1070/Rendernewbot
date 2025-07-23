const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Server, TransactionBuilder, Operation, Keypair, Asset } = require('stellar-sdk');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to create + sign + submit transaction
app.post('/submitTransaction', async (req, res) => {
  try {
    const { senderSecret, receiver, amount } = req.body;
    if (!senderSecret || !receiver || !amount) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const server = new Server('https://api.mainnet.minepi.com');
    const sourceKeypair = Keypair.fromSecret(senderSecret);
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());
    const fee = await server.fetchBaseFee();

    const transaction = new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase: 'Pi Mainnet'
    })
      .addOperation(Operation.payment({
        destination: receiver,
        asset: Asset.native(),
        amount: amount
      }))
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);
    const response = await server.submitTransaction(transaction);

    res.json({ success: true, result: response });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      reason: error.response?.data?.extras?.result_codes || 'Unknown error'
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
