const { Server, Transaction } = require('stellar-sdk');

exports.handler = async function(event) {
  try {
    const { xdr } = JSON.parse(event.body);
    if (!xdr) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing signed XDR' }) };
    }

    const server = new Server('https://api.mainnet.minepi.com');
    const transaction = new Transaction(xdr, 'Pi Mainnet');
    const response = await server.submitTransaction(transaction);

    return { statusCode: 200, body: JSON.stringify({ success: true, result: response }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
