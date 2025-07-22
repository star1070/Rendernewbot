const express = require('express');
const bodyParser = require('body-parser');
const { Server, Transaction } = require('stellar-sdk');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static('public'));

const HORIZON_URL = 'https://api.mainnet.minepi.com';
const server = new Server(HORIZON_URL);

// Helper: transaction submit with auto-retry
async function submitWithRetry(transaction, retries = 5) {
  while (retries > 0) {
    try {
      return await server.submitTransaction(transaction);
    } catch (e) {
      retries--;
      console.log(`[API] Submit failed (${retries} retries left):`, e.response?.data || e.message);
      if (retries === 0) throw e;
    }
  }
}

app.post('/submitTransaction', async (req, res) => {
  const { xdr } = req.body;
  if (!xdr) {
    return res.status(400).json({ success: false, error: 'Missing signed XDR' });
  }

  try {
    // Multiple XDRs (batch mode)
    if (Array.isArray(xdr)) {
      const results = await Promise.allSettled(
        xdr.map(async (tx, idx) => {
          try {
            const transaction = new Transaction(tx, 'Pi Mainnet');
            const response = await submitWithRetry(transaction, 5);
            return { index: idx, success: true, result: response };
          } catch (e) {
            return { index: idx, success: false, error: e.message, raw: e.response?.data || null };
          }
        })
      );
      return res.json({ success: true, batch: results });
    }

    // Single XDR
    const transaction = new Transaction(xdr, 'Pi Mainnet');
    const response = await submitWithRetry(transaction, 5);

    res.json({ success: true, result: response });
  } catch (e) {
    console.error('[API] Fatal error:', e.response?.data || e.message);
    res.status(500).json({
      success: false,
      error: e.message,
      reason: e.response?.data?.extras?.result_codes || 'Unknown error'
    });
  }
});

app.listen(port, () => {
  console.log(`[API] Running on port ${port}`);
});
