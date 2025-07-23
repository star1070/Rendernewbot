const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Server, Transaction } = require('stellar-sdk');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(bodyParser.json());

// Serve frontend build
app.use(express.static(path.join(__dirname, 'public')));

// Pi Network transaction submit endpoint
app.post('/submitTransaction', async (req, res) => {
  try {
    const { xdr } = req.body;
    if (!xdr) {
      return res.status(400).json({ success: false, error: 'Missing signed XDR' });
    }

    console.log("Received XDR:", xdr);

    const server = new Server('https://api.mainnet.minepi.com');
    const transaction = new Transaction(xdr, 'Pi Mainnet');
    const response = await server.submitTransaction(transaction);

    return res.json({ success: true, result: response });
  } catch (error) {
    console.error("Transaction submission failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      reason: error.response?.data?.extras?.result_codes || 'Unknown error'
    });
  }
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});
