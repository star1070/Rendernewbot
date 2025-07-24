const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Diagnostic endpoint
app.post('/submitTransaction', (req, res) => {
  console.log('Received POST /submitTransaction');
  console.log('Request body:', req.body);

  if (!req.body || Object.keys(req.body).length === 0) {
    console.log('No data received from frontend.');
  }

  // Temporary response
  res.json({ success: true, received: req.body });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Diagnostic API running on port ${PORT}`);
});
