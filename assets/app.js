document.addEventListener("DOMContentLoaded", () => {
  // ===== Ano no footer =====
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===== Toast =====
  const toast = document.getElementById("toast");
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1400);
  }

  // ===== Copiar texto (utilitário) =====
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

  // ===== Copiar IP =====
  const ipEl = document.getElementById("serverIp");
  const copyBtn = document.getElementById("copyIpBtn");
  if (copyBtn && ipEl) {
    copyBtn.addEventListener("click", async () => {
      const ip = ipEl.textContent.trim();
      const ok = await copyText(ip);
      showToast(ok ? "IP copiado!" : "Não consegui copiar :(");
    });
  }

  // ===== Navbar ativa (desktop + mobile) =====
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav a, .mobile-nav a").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (!href) return;
    if (href === path) a.classList.add("is-active");
  });

  // ===== Menu Mobile (hambúrguer) =====
  const menuBtn = document.getElementById("menuBtn");
  const mobileNav = document.getElementById("mobileNav");
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", () => {
      mobileNav.classList.toggle("open");
      const isOpen = mobileNav.classList.contains("open");
      menuBtn.setAttribute("aria-expanded", String(isOpen));
    });

    // fecha ao clicar em um link no mobile
    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mobileNav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ===== Status do Servidor (mcsrvstat.us) =====
  // Atualiza elementos se existirem:
  // - statusText (ONLINE/OFFLINE)
  // - playersText (ex: 12/200)
  const statusText = document.getElementById("statusText");
  const playersText = document.getElementById("playersText");

  async function fetchServerStatus(host) {
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
    } catch {
      if (statusText) statusText.textContent = "OFFLINE";
      if (playersText) playersText.textContent = "—";
    }
  }

  updateStatus();
  setInterval(updateStatus, 60000);

  // ===== Accordion (Regras) =====
  // (só roda se tiver as classes na página)
  document.querySelectorAll(".rule-acc-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.nextElementSibling;
      if (!panel || !panel.classList.contains("rule-acc-panel")) return;
      panel.classList.toggle("open");
    });
  });

  // ===== Helpers opcionais (se você quiser usar no futuro) =====
  // Exemplo: showToast("Bem-vindo!");
});

// ============================
// STATUS DO SERVIDOR
// ============================

async function atualizarStatusServidor() {

const ip = "redecats.jogar.in"; // coloque seu IP aqui

try {

const res = await fetch(`https://api.mcsrvstat.us/2/${ip}`);
const data = await res.json();

const statusText = document.getElementById("statusText");
const playersText = document.getElementById("playersText");

if (!statusText || !playersText) return;

if (data.online) {

statusText.innerText = "ONLINE";
statusText.style.color = "#00ff9c";

playersText.innerText = `${data.players.online}/${data.players.max}`;

} else {

statusText.innerText = "OFFLINE";
statusText.style.color = "#ff4a4a";

playersText.innerText = "0/0";

}

} catch (err) {

console.log("Erro ao buscar status do servidor");

}

}

atualizarStatusServidor();
setInterval(atualizarStatusServidor, 30000);
