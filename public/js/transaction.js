<script>
document.addEventListener("DOMContentLoaded", function () {
  const transferButton = document.querySelector('button:contains("Initiate Transfer")');

  if (transferButton) {
    transferButton.addEventListener("click", async function () {
      try {
        const xdr = window.signedXDR || null; // agar XDR memory me ho
        if (!xdr) {
          alert("Signed transaction XDR missing");
          return;
        }

        const res = await fetch("/.netlify/functions/submitTransaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xdr }),
        });

        const data = await res.json();
        if (data.success) {
          alert("Transaction Submitted Successfully!");
        } else {
          alert("Transaction Failed: " + data.error);
        }
      } catch (err) {
        console.error("Transaction Error:", err);
        alert("Error submitting transaction");
      }
    });
  }
});
</script>
