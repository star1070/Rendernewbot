const express = require('express');
const bodyParser = require('body-parser');
const { Server, Transaction } = require('stellar-sdk');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static('public'));  // frontend serve karega

// Transaction submit endpoint
app.post('/submitTransaction', async (req, res) => {
  try {
    const { xdr } = req.body;

    if (!xdr) {
      return res.status(400).json({ success: false, error: 'Missing signed XDR' });
    }

    console.log('[API] Received XDR:', xdr.slice(0, 40) + '...');

    const server = new Server('https://api.mainnet.minepi.com');
    const transaction = new Transaction(xdr, 'Pi Mainnet');

    const response = await server.submitTransaction(transaction);

    console.log('[API] Transaction Success:', response.hash);
    res.json({ success: true, result: response });
  } catch (e) {
    console.error('[API] SubmitTransaction Error:', e.message);
    res.status(500).json({
      success: false,
      error: e.message,
      reason: e.response?.data?.extras?.result_codes || 'Unknown error'
    });
  }
});

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
