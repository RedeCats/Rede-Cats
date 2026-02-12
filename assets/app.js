document.addEventListener("DOMContentLoaded", () => {
  // Ano no footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Copiar IP
  const ipEl = document.getElementById("serverIp");
  const copyBtn = document.getElementById("copyIpBtn");
  const toast = document.getElementById("toast");

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
    } catch {
      try {
        const temp = document.createElement("input");
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
        return true;
      } catch {
        return false;
      }
    }
  }

  if (copyBtn && ipEl) {
    copyBtn.addEventListener("click", async () => {
      const ip = ipEl.textContent.trim();
      const ok = await copyText(ip);
      showToast(ok ? "IP copiado!" : "Não consegui copiar :(");
    });
  }

  // Navbar ativa (marca a página atual)
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav a").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (!href) return;
    if (href === path) a.classList.add("is-active");
  });
});
