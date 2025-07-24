const StellarSdk = require("stellar-sdk");

exports.handler = async (event) => {
  try {
    const { senderSecret, receiverAddress, amount } = JSON.parse(event.body);

    if (!senderSecret || !receiverAddress || !amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const server = new StellarSdk.Server("https://api.mainnet.minepi.com");

    // Load account
    const sourceKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
    const account = await server.loadAccount(sourceKeypair.publicKey());

    // Build transaction
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: await server.fetchBaseFee(),
      networkPassphrase: StellarSdk.Networks.PUBLIC,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: receiverAddress,
          asset: StellarSdk.Asset.native(),
          amount: amount.toString(),
        })
      )
      .setTimeout(30)
      .build();

    // Sign
    transaction.sign(sourceKeypair);

    // Submit transaction
    const result = await server.submitTransaction(transaction);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, result }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
