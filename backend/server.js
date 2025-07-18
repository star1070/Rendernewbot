
const express = require("express");
const { Keypair, Server, TransactionBuilder, Operation, Asset } = require("stellar-sdk");
const { deriveKeypair } = require("stellar-hd-wallet");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
const server = new Server("https://api.mainnet.minepi.com");

function getKeypairFromPassphrase(mnemonic) {
  const keypair = deriveKeypair(mnemonic);
  return Keypair.fromSecret(keypair.secret());
}

function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

async function sendTransaction(sender, to, amount) {
  let attempts = 3;
  while (attempts > 0) {
    try {
      const account = await server.loadAccount(sender.publicKey());
      const balances = account.balances.find(b => b.asset_type === "native");
      const totalBalance = parseFloat(balances.balance);
      const locked = parseFloat(balances?.limit || "0");
      const available = totalBalance - locked;

      if (available < parseFloat(amount)) {
        return { to, success: false, error: "Insufficient unlocked balance" };
      }

      const tx = new TransactionBuilder(account, {
        fee: await server.fetchBaseFee(),
        networkPassphrase: "Pi Mainnet"
      })
        .addOperation(Operation.payment({
          destination: to,
          asset: Asset.native(),
          amount: amount
        }))
        .setTimeout(30)
        .build();

      tx.sign(sender);
      const result = await server.submitTransaction(tx);
      return { to, success: true, hash: result.hash };

    } catch (e) {
      attempts--;
      if (attempts === 0) return { to, success: false, error: e.message };
      await delay(300 + Math.random() * 400);
    }
  }
}

app.post("/submit-parallel", async (req, res) => {
  const { passphrase, amount, receivers } = req.body;
  try {
    const sender = getKeypairFromPassphrase(passphrase);
    const results = await Promise.all(receivers.map(to => sendTransaction(sender, to.trim(), amount)));
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => console.log("Optimized Bot running on http://localhost:3000"));
