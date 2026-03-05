document.addEventListener("DOMContentLoaded", () => {
  // ===== Ano no footer =====
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===== Copiar IP =====
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

  // ===== Navbar ativa =====
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav a, .mobile-nav a").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (!href) return;
    if (href === path) a.classList.add("is-active");
  });

  // ===== Menu Mobile =====
  const menuBtn = document.getElementById("menuBtn");
  const mobileNav = document.getElementById("mobileNav");
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", () => {
      mobileNav.classList.toggle("open");
      const isOpen = mobileNav.classList.contains("open");
      menuBtn.setAttribute("aria-expanded", String(isOpen));
    });
    // fecha ao clicar em link
    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mobileNav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ===== Status do Servidor (mcsrvstat.us) =====
  // Atualiza: statusText, playersText
  const statusText = document.getElementById("statusText");
  const playersText = document.getElementById("playersText");

  async function fetchServerStatus(host) {
    // API pública simples (funciona com GitHub Pages)
    const url = `https://api.mcsrvstat.us/2/${encodeURIComponent(host)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  async function updateStatus() {
    if (!ipEl || (!statusText && !playersText)) return;

    const host = ipEl.textContent.trim();
    try {
      if (statusText) statusText.textContent = "Carregando…";
      if (playersText) playersText.textContent = "—";

      const data = await fetchServerStatus(host);

      const online = !!data.online;
      if (statusText) statusText.textContent = online ? "ONLINE" : "OFFLINE";

      if (playersText) {
        if (online && data.players && typeof data.players.online === "number") {
          const on = data.players.online;
          const max = typeof data.players.max === "number" ? data.players.max : null;
          playersText.textContent = max ? `${on}/${max}` : String(on);
        } else {
          playersText.textContent = "—";
        }
      }
    } catch (e) {
      if (statusText) statusText.textContent = "OFFLINE";
      if (playersText) playersText.textContent = "—";
      // opcional: showToast("Não deu pra carregar o status agora.")
    }
  }

  updateStatus();
  // atualiza a cada 60s
  setInterval(updateStatus, 60000);
});

// ===== Accordion (regras) =====
document.querySelectorAll(".rule-acc-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const panel = btn.nextElementSibling;
    if (!panel || !panel.classList.contains("rule-acc-panel")) return;
    panel.classList.toggle("open");
  });
});
