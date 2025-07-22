const express = require('express');
const bodyParser = require('body-parser');
const { Server, Transaction } = require('stellar-sdk');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static('public')); // Static files

// Private Horizon servers pool
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

function getFastServer() {
  const url = HORIZON_SERVERS[Math.floor(Math.random() * HORIZON_SERVERS.length)];
  console.log(`[API] Using Horizon node: ${url}`);
  return new Server(url);
}

async function submitWithRetry(server, transaction, retries = 5) {
  while (retries > 0) {
    try {
      return await server.submitTransaction(transaction);
    } catch (e) {
      console.log(`[API] Submit failed (${retries} retries left):`, e.response?.data || e.message);
      retries--;
      if (retries === 0) throw e;
    }
  }
}

function sendJSON(res, data) {
  const jsonString = JSON.stringify(data);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(jsonString));
  res.status(200).send(jsonString);
}

app.post('/submitTransaction', async (req, res) => {
  const { xdr } = req.body;

  if (!xdr) {
    return sendJSON(res, { success: false, error: 'Missing signed XDR' });
  }

  try {
    const server = getFastServer();

    // Batch array
    if (Array.isArray(xdr)) {
      const results = await Promise.allSettled(
        xdr.map(async (tx, index) => {
          try {
            const transaction = new Transaction(tx, 'Pi Mainnet');
            const result = await submitWithRetry(server, transaction, 5);
            return { index, success: true, result };
          } catch (e) {
            return { index, success: false, error: e.message, raw: e.response?.data || null };
          }
        })
      );
      return sendJSON(res, { success: true, batch: results });
    }

    // Single transaction
    try {
      const transaction = new Transaction(xdr, 'Pi Mainnet');
      const response = await submitWithRetry(server, transaction, 5);
      return sendJSON(res, { success: true, result: response });
    } catch (e) {
      return sendJSON(res, { success: false, error: e.message, raw: e.response?.data || null });
    }
  } catch (e) {
    console.error('[API] Fatal Error:', e);
    return sendJSON(res, { success: false, error: e.message || 'Unknown fatal error' });
  }
});

app.listen(port, () => {
  console.log(`[API] Running on port ${port}`);
});
