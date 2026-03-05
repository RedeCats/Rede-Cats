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

    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mobileNav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ===== Accordion (Regras / FAQ) =====
  document.querySelectorAll(".rule-acc-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.nextElementSibling;
      if (!panel || !panel.classList.contains("rule-acc-panel")) return;
      panel.classList.toggle("open");
    });
  });

  // ===== Helpers =====
  function stripMinecraftFormatting(s) {
    if (!s) return "";
    // Remove § + código (ex: §a, §l) e & + código (ex: &a)
    return String(s)
      .replace(/§[0-9A-FK-ORa-fk-or]/g, "")
      .replace(/&[0-9A-FK-ORa-fk-or]/g, "");
  }

  // ===== Status do Servidor (mcsrvstat.us) =====
  const statusText = document.getElementById("statusText");
  const playersText = document.getElementById("playersText");
  const motdText = document.getElementById("motdText");
  const versionText = document.getElementById("versionText");
  const pingText = document.getElementById("pingText");

  async function fetchServerStatus(host) {
    const url = `https://api.mcsrvstat.us/2/${encodeURIComponent(host)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  async function updateStatus() {
    if (!ipEl) return;

    // Se a página não tem nada de status, não faz request atoa
    const hasAny =
      statusText || playersText || motdText || versionText || pingText;
    if (!hasAny) return;

    const host = ipEl.textContent.trim();

    try {
      if (statusText) statusText.textContent = "Carregando…";
      if (playersText) playersText.textContent = "—";
      if (motdText) motdText.textContent = "—";
      if (versionText) versionText.textContent = "—";
      if (pingText) pingText.textContent = "—";

      const data = await fetchServerStatus(host);

      const online = !!data.online;

      // Status
      if (statusText) statusText.textContent = online ? "ONLINE" : "OFFLINE";

      // Players
      if (playersText) {
        if (online && data.players && typeof data.players.online === "number") {
          const on = data.players.online;
          const max = typeof data.players.max === "number" ? data.players.max : null;
          playersText.textContent = max ? `${on}/${max}` : String(on);
        } else {
          playersText.textContent = "—";
        }
      }

      // Versão
      if (versionText) {
        if (online && data.version) versionText.textContent = String(data.version);
        else versionText.textContent = "—";
      }

      // Ping (nem sempre vem — depende do retorno)
      if (pingText) {
        if (online && typeof data.ping === "number") pingText.textContent = `${data.ping}ms`;
        else pingText.textContent = "—";
      }

      // MOTD
      if (motdText) {
        if (online && data.motd) {
          // data.motd.clean costuma ser array de linhas
          if (Array.isArray(data.motd.clean) && data.motd.clean.length) {
            motdText.textContent = data.motd.clean.join(" ").trim();
          } else if (typeof data.motd.clean === "string") {
            motdText.textContent = data.motd.clean.trim();
          } else if (Array.isArray(data.motd.raw) && data.motd.raw.length) {
            motdText.textContent = stripMinecraftFormatting(data.motd.raw.join(" ")).trim();
          } else {
            motdText.textContent = "—";
          }
        } else {
          motdText.textContent = "—";
        }
      }
    } catch {
      if (statusText) statusText.textContent = "OFFLINE";
      if (playersText) playersText.textContent = "—";
      if (motdText) motdText.textContent = "—";
      if (versionText) versionText.textContent = "—";
      if (pingText) pingText.textContent = "—";
    }
  }

  updateStatus();
  setInterval(updateStatus, 60000);
});
