
/* Rede Cats - Carrinho VIP + Cash */
(function () {
  const CART_KEY = "redecats_cart_v2";
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function brl(v){
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function loadCart(){
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch { return []; }
  }
  function saveCart(items){
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function addItem(item){
    const items = loadCart();
    const found = items.find(x => x.id === item.id);
    if(found) found.qty += 1;
    else items.push({ ...item, qty: 1 });
    saveCart(items);
    render();
    openCart();
    toast(`${item.name} adicionado!`);
  }

  function removeItem(id){
    const items = loadCart().filter(x => x.id !== id);
    saveCart(items);
    render();
  }

  function changeQty(id, delta){
    const items = loadCart();
    const it = items.find(x => x.id === id);
    if(!it) return;
    it.qty = Math.max(1, it.qty + delta);
    saveCart(items);
    render();
  }

  function total(items){
    return items.reduce((acc, it) => acc + (it.price * it.qty), 0);
  }

  async function copy(text){
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      try{
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        el.remove();
        return true;
      } catch { return false; }
    }
  }

  function orderSummary(items){
    const lines = [];
    lines.push("🛒 Pedido - Rede Cats");
    lines.push("");
    items.forEach(it => {
      const label = it.category ? `[${it.category}] ` : "";
      lines.push(`• ${label}${it.name} — ${it.qty}x — ${brl(it.price * it.qty)}`);
    });
    lines.push("");
    lines.push(`TOTAL: ${brl(total(items))}`);
    lines.push("");
    lines.push("Nick no servidor: ");
    lines.push("Forma de pagamento: ");
    return lines.join("\n");
  }

  function render(){
    const drawer = $("#cartDrawer");
    const list = $("#cartItems");
    const badge = $("#cartBadge");
    const totalEl = $("#cartTotal");
    if(!drawer || !list || !badge || !totalEl) return;

    const items = loadCart();
    const qtyAll = items.reduce((a,i)=>a+i.qty,0);
    badge.textContent = qtyAll;
    badge.style.display = qtyAll ? "inline-flex" : "none";

    list.innerHTML = "";
    if(!items.length){
      list.innerHTML = `<div class="cart-empty">Seu carrinho está vazio.</div>`;
      totalEl.textContent = brl(0);
      return;
    }

    items.forEach(it => {
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <img class="cart-item__img" src="${it.img}" alt="${it.name}">
        <div class="cart-item__meta">
          <div class="cart-item__name">${it.name}</div>
          <div class="cart-item__cat">${it.category || ''}</div>
          <div class="cart-item__price">${it.qty}x ${brl(it.price)} = <strong>${brl(it.price * it.qty)}</strong></div>
          <div class="cart-item__qty">
            <button class="qty-btn" data-dec="${it.id}" aria-label="Diminuir">−</button>
            <span class="qty-val">${it.qty}</span>
            <button class="qty-btn" data-inc="${it.id}" aria-label="Aumentar">+</button>
          </div>
        </div>
        <button class="cart-item__trash" data-remove="${it.id}" aria-label="Remover">🗑️</button>
      `;
      list.appendChild(row);
    });

    totalEl.textContent = brl(total(items));

    $$('[data-remove]', list).forEach(b => b.addEventListener('click', () => removeItem(b.dataset.remove)));
    $$('[data-inc]', list).forEach(b => b.addEventListener('click', () => changeQty(b.dataset.inc, +1)));
    $$('[data-dec]', list).forEach(b => b.addEventListener('click', () => changeQty(b.dataset.dec, -1)));
  }

  function openCart(){
    const drawer = $("#cartDrawer");
    const overlay = $("#cartOverlay");
    if(drawer) drawer.classList.add("open");
    if(overlay) overlay.classList.add("open");
  }
  function closeCart(){
    const drawer = $("#cartDrawer");
    const overlay = $("#cartOverlay");
    if(drawer) drawer.classList.remove("open");
    if(overlay) overlay.classList.remove("open");
  }

  function toast(msg){
    const t = $("#toast");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"), 1400);
  }

  function bindAdd(selector){
    $$(selector).forEach(btn => {
      btn.addEventListener('click', () => {
        addItem({
          id: btn.dataset.id,
          name: btn.dataset.name,
          category: btn.dataset.category || '',
          price: Number(btn.dataset.price || 0),
          img: btn.dataset.img || 'assets/felino-neon.png'
        });
      });
    });
  }

  function init(){
    bindAdd('[data-addcash], [data-addcart]');

    const fab = $("#cartFab");
    const closeBtn = $("#cartClose");
    const overlay = $("#cartOverlay");
    const continueBtn = $("#cartContinue");
    const finishBtn = $("#cartFinish");

    if(fab) fab.addEventListener("click", openCart);
    if(closeBtn) closeBtn.addEventListener("click", closeCart);
    if(overlay) overlay.addEventListener("click", closeCart);
    if(continueBtn) continueBtn.addEventListener("click", closeCart);

    if(finishBtn){
      finishBtn.addEventListener("click", async () => {
        const items = loadCart();
        if(!items.length){ toast("Carrinho vazio."); return; }
        const summary = orderSummary(items);
        const ok = await copy(summary);
        toast(ok ? "Resumo copiado! Cole no ticket." : "Não consegui copiar :(");
        window.open("https://discord.gg/GQZGduc9", "_blank", "noopener");
      });
    }

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
