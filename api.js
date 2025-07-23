const express = require('express');
const bodyParser = require('body-parser');
const { Server, Transaction } = require('stellar-sdk');

const app = express();
const port = process.env.PORT || 10000;

// Horizon nodes for failover
const horizonNodes = [
  'https://api.mainnet.minepi.com',
  'https://horizon.stellar.org'
];

app.use(bodyParser.json());
app.use(express.static('public')); // for frontend

// Utility to pick fastest Horizon node
async function getFastServer() {
  for (const node of horizonNodes) {
    try {
      const server = new Server(node, { allowHttp: false });
      await server.ledgers().limit(1).call();
      console.log(`[API] Using Horizon node: ${node}`);
      return server;
    } catch (e) {
      console.warn(`[API] Node failed: ${node}`);
    }
  }
  throw new Error('All Horizon nodes unavailable');
}

app.post('/submitTransaction', async (req, res) => {
  try {
    const { xdr } = req.body;
    if (!xdr) {
      return res.status(400).json({ success: false, error: 'Missing signed XDR' });
    }

    const server = await getFastServer();
    const transaction = new Transaction(xdr, 'Pi Mainnet');
    const response = await server.submitTransaction(transaction);

    res.json({ success: true, result: response });
  } catch (e) {
    console.error('[API] Submit error:', e.message);
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
