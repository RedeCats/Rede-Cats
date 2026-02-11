// 1) COLOQUE AQUI O LINK DA SUA WIKI (GitBook):
// Exemplo (o seu print mostrou algo assim):
// https://redecats.gitbook.io/redecats-docs/
const WIKI_URL = "https://redecats.gitbook.io/redecats-docs/";

// 2) IP DO SERVIDOR
const SERVER_IP = "redecats.jogar.in";

function openWiki(path = "") {
  const base = WIKI_URL.replace(/\/$/, "");
  const url = path ? `${base}/${path.replace(/^\//, "")}` : base;
  window.open(url, "_blank", "noopener");
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert("IP copiado: " + text);
  }).catch(() => {
    // fallback simples
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
    alert("IP copiado: " + text);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const ipEl = document.getElementById("serverIp");
  if (ipEl) ipEl.textContent = SERVER_IP;

  // Botão do topo "Wiki"
  const btnWiki = document.getElementById("btnWiki");
  if (btnWiki) btnWiki.addEventListener("click", (e) => {
    e.preventDefault();
    openWiki("");
  });

  // Copiar IP
  const copyBtn = document.getElementById("copyIpBtn");
  if (copyBtn) copyBtn.addEventListener("click", () => copyText(SERVER_IP));

  // Cards (cada um abre um lugar da wiki — você pode mudar depois)
  const map = [
    ["cardIntro", ""],          // home da wiki
    ["cardComoEntrar", ""],
    ["cardRegras", ""],
    ["cardSistemas", ""],
    ["cardVips", ""],
    ["cardSuporte", ""],
  ];

  map.forEach(([id, path]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openWiki(path);
    });
  });
});
