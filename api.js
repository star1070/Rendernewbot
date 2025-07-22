const express = require('express');
const bodyParser = require('body-parser');
const { Server, Transaction } = require('stellar-sdk');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static('public'));  // Static folder serve करेगा

// Fast private Horizon servers pool
const HORIZON_SERVERS = [
  'http://14.160.23.186:8000',
  'http://14.248.124.194:8000',
  'http://113.160.156.51:8000',
  'http://113.22.229.219:8000',
  'http://14.187.190.141:8000',
  'http://116.100.186.130:8000',
  'http://1.251.56.231:8000',
  'http://14.36.220.65:8000',
  'http://81.240.60.124:8000'
];

// Random fast Horizon node choose करने वाला function
function getFastServer() {
  const url = HORIZON_SERVERS[Math.floor(Math.random() * HORIZON_SERVERS.length)];
  return new Server(url);
}

// Auto-retry logic
async function submitWithRetry(server, transaction, retries = 5) {
  while (retries > 0) {
    try {
      return await server.submitTransaction(transaction);
    } catch (e) {
      retries--;
      if (retries === 0) throw e;
    }
  }
}

// POST endpoint for transaction submission
app.post('/submitTransaction', async (req, res) => {
  try {
    const { xdr } = req.body;

    if (!xdr) {
      return res.status(400).json({ success: false, error: 'Missing signed XDR' });
    }

    const server = getFastServer();

    // Batch processing for multiple XDRs
    if (Array.isArray(xdr)) {
      const results = await Promise.allSettled(
        xdr.map(tx => {
          const transaction = new Transaction(tx, 'Pi Mainnet');
          return submitWithRetry(server, transaction, 5);
        })
      );
      return res.json({ success: true, batch: results });
    }

    // Single transaction
    const transaction = new Transaction(xdr, 'Pi Mainnet');
    const response = await submitWithRetry(server, transaction, 5);
    res.json({ success: true, result: response });
  } catch (e) {
    console.error("SubmitTransaction Error:", e);
    res.status(500).json({
      success: false,
      error: e.message,
      reason: e.response?.data?.extras?.result_codes || 'Unknown error'
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
