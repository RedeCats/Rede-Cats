function setActiveNav() {
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll("[data-nav]").forEach(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href.endsWith(path)) a.classList.add("active");
    else a.classList.remove("active");
  });
}

function copyIP(ip) {
  navigator.clipboard.writeText(ip).then(() => {
    const el = document.getElementById("copyStatus");
    if (el) {
      el.textContent = "IP copiado ✅";
      setTimeout(() => (el.textContent = ""), 2200);
    }
  }).catch(() => {
    alert("Não consegui copiar automaticamente. Copie manualmente: " + ip);
  });
}

function initShopFilters() {
  const buttons = document.querySelectorAll("[data-cat]");
  const cards = document.querySelectorAll("[data-product]");
  if (!buttons.length || !cards.length) return;

  function apply(cat) {
    buttons.forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
    cards.forEach(c => {
      const ok = (cat === "todos") || (c.dataset.product === cat);
      c.style.display = ok ? "" : "none";
    });
  }

  buttons.forEach(b => b.addEventListener("click", () => apply(b.dataset.cat)));
  apply("todos");
}

function initRGB() {
  const nick = document.getElementById("nick");
  const color1 = document.getElementById("color1");
  const color2 = document.getElementById("color2");
  const mode = document.getElementById("mode");
  const out = document.getElementById("nickPreview");
  const cmd = document.getElementById("cmdPreview");

  if (!nick || !color1 || !color2 || !mode || !out || !cmd) return;

  function update() {
    const n = nick.value || "RedeCats";
    const c1 = color1.value;
    const c2 = color2.value;

    if (mode.value === "solid") {
      out.style.background = "none";
      out.style.color = c1;
      out.textContent = n;
      cmd.textContent = `Exemplo (plugin varia): /nick ${n}`;
      return;
    }

    out.style.color = "transparent";
    out.style.backgroundImage = `linear-gradient(90deg, ${c1}, ${c2})`;
    out.style.webkitBackgroundClip = "text";
    out.style.backgroundClip = "text";
    out.textContent = n;

    cmd.textContent = `Exemplo (plugin varia): /nick ${n} (gradiente ${c1} → ${c2})`;
  }

  [nick, color1, color2, mode].forEach(el => el.addEventListener("input", update));
  update();
}

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  initShopFilters();
  initRGB();

  const copyBtn = document.getElementById("copyIpBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => copyIP(copyBtn.dataset.ip));
  }
});
