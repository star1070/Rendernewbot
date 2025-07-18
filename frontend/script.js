async function submit() {
  const passphrase = document.getElementById("passphrase").value.trim();
  const amount = document.getElementById("amount").value.trim();
  const receivers = document.getElementById("receivers").value.trim().split(/\r?\n/);
  const statusLog = document.getElementById("statusLog");
  statusLog.innerHTML = "";

  const res = await fetch("/submit-parallel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase, amount, receivers })
  });

  const data = await res.json();
  data.results.forEach(r => {
    const p = document.createElement("p");
    p.textContent = r.success ? `✅ ${r.to} - ${r.hash}` : `❌ ${r.to} - ${r.error}`;
    p.className = r.success ? "success" : "fail";
    statusLog.appendChild(p);
    statusLog.scrollTop = statusLog.scrollHeight;
  });
}
