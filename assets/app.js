document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const ipEl = document.getElementById("serverIp");
  const copyBtn = document.getElementById("copyIpBtn");
  const toast = document.getElementById("toast");

  // Se você quiser, troque aqui o IP padrão (ou deixe o texto do HTML)
  const fallbackIP = ipEl ? ipEl.textContent.trim() : "";

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const temp = document.createElement("input");
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  if (copyBtn && ipEl) {
    copyBtn.addEventListener("click", async () => {
      const ip = ipEl.textContent.trim() || fallbackIP;
      const ok = await copyText(ip);
      showToast(ok ? "IP copiado!" : "Não consegui copiar :(");
    });
  }

  // “Online” (placeholder simples)
  const onlineCount = document.getElementById("onlineCount");
  if (onlineCount && (onlineCount.textContent || "").trim() === "--") {
    onlineCount.textContent = "Online";
  }
});
