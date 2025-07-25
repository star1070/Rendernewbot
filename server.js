const express = require('express');
const path = require('path');
const cors = require('cors');
const { Server, TransactionBuilder, Networks } = require('stellar-sdk');

const app = express();

const PI_HORIZON_SERVER = 'https://api.mainnet.minepi.com';
const server = new Server(PI_HORIZON_SERVER, { allowHttp: true });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// स्टैटिक फाइलों (HTML, CSS, JS, Fonts, Images) को सर्व करने के लिए
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint
app.post('/api/submitTransaction', async (req, res) => {
  const { xdr } = req.body;
  if (!xdr) {
    return res.status(400).json({ success: false, error: 'XDR is missing' });
  }

  try {
    const transaction = TransactionBuilder.fromXDR(xdr, Networks.PUBLIC); // Pi मेननेट = PUBLIC
    console.log('Submitting transaction to Pi Network...');
    const txResponse = await server.submitTransaction(transaction);
    console.log('Transaction successful:', txResponse.hash);
    res.json({
      success: true,
      hash: txResponse.hash,
      result: txResponse
    });
  } catch (error) {
    const errorDetails = error.response ? error.response.data : {
      title: "Backend Error",
      detail: error.message
    };
    console.error('Submission Error:', JSON.stringify(errorDetails, null, 2));
    res.status(400).json({
      success: false,
      error: 'Transaction submission failed',
      details: errorDetails
    });
  }
});

// Catch-all: किसी भी अन्य रूट के लिए index.html भेजें
// यह SPA (Single Page Application) के लिए जरूरी है
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
