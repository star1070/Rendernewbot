const express = require('express');
const bodyParser = require('body-parser');
const { Server, Transaction } = require('stellar-sdk');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static('public')); // frontend serve करेगा

// Horizon server list
const horizonServers = [
  'https://api.mainnet.minepi.com',
  'https://horizon.pi-blockchain.net'
];

// Round-robin से fastest server select करेगा
let lastServerIndex = 0;
function getNextServer() {
  lastServerIndex = (lastServerIndex + 1) % horizonServers.length;
  return horizonServers[lastServerIndex];
}

// Transaction submit करने के लिए endpoint
app.post('/submitTransaction', async (req, res) => {
  try {
    const { xdr } = req.body;

    if (!xdr) {
      return res.status(400).json({ success: false, error: 'Missing signed XDR' });
    }

    console.log('Received XDR:', xdr.substring(0, 50) + '...');

    const serverUrl = getNextServer();
    const server = new Server(serverUrl);

    const transaction = new Transaction(xdr, 'Pi Mainnet');
    const response = await server.submitTransaction(transaction);

    console.log('Transaction submitted:', response.hash);
    res.json({ success: true, result: response });
  } catch (e) {
    console.error('SubmitTransaction Error:', e.message);
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
