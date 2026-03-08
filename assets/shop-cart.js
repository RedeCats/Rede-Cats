/* Rede Cats - Carrinho VIP + Cash + Cupom */
(function () {
  const CART_KEY = "redecats_cart_v2";
  const COUPON_KEY = "redecats_coupon_v1";
  const COUPONS = {
    "ABERTURA30": { code: "ABERTURA30", type: "percent", value: 30, label: "30% OFF na abertura" }
  };

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function brl(v){
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function loadCart(){
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch { return []; }
  }

  function saveCart(items){
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function loadCoupon(){
    try { return JSON.parse(localStorage.getItem(COUPON_KEY) || "null"); }
    catch { return null; }
  }

  function saveCoupon(coupon){
    if(coupon) localStorage.setItem(COUPON_KEY, JSON.stringify(coupon));
    else localStorage.removeItem(COUPON_KEY);
  }

  function subtotal(items){
    return items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.qty || 0)), 0);
  }

  function normalizeCoupon(code){
    return String(code || "").trim().toUpperCase();
  }

  function couponDiscount(sub, coupon){
    if(!coupon || !sub) return 0;
    if(coupon.type === "percent") return Math.min(sub, sub * (coupon.value / 100));
    if(coupon.type === "fixed") return Math.min(sub, coupon.value);
    return 0;
  }

  async function copy(text){
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        el.remove();
        return true;
      } catch {
        return false;
      }
    }
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
    setTimeout(() => t.classList.remove("show"), 1500);
  }

  function addItem(item){
    const items = loadCart();
    const found = items.find(x => x.id === item.id);
    if(found) found.qty += 1;
    else items.push({ ...item, qty: 1 });
    saveCart(items);
    render();
    openCart();
    toast(`${item.name} adicionado ao carrinho!`);
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
    it.qty += delta;
    if(it.qty <= 0){
      saveCart(items.filter(x => x.id !== id));
    } else {
      saveCart(items);
    }
    render();
  }

  function orderSummary(items){
    const currentCoupon = loadCoupon();
    const sub = subtotal(items);
    const discount = couponDiscount(sub, currentCoupon);
    const finalTotal = Math.max(0, sub - discount);
    const lines = [];
    lines.push("🛒 Pedido - Rede Cats");
    lines.push("");
    items.forEach(it => {
      const label = it.category ? `[${it.category}] ` : "";
      lines.push(`• ${label}${it.name} — ${it.qty}x — ${brl(it.price * it.qty)}`);
    });
    lines.push("");
    lines.push(`SUBTOTAL: ${brl(sub)}`);
    if(currentCoupon){
      lines.push(`CUPOM: ${currentCoupon.code}`);
      lines.push(`DESCONTO: -${brl(discount)}`);
    }
    lines.push(`TOTAL FINAL: ${brl(finalTotal)}`);
    lines.push("");
    lines.push("Nick no servidor: ");
    lines.push("Forma de pagamento: ");
    return lines.join("\n");
  }

  function render(){
    const list = $("#cartItems");
    const badge = $("#cartBadge");
    const totalEl = $("#cartTotal");
    const subEl = $("#cartSubtotal");
    const discEl = $("#cartDiscount");
    const feedbackEl = $("#cartCouponFeedback");
    const inputEl = $("#cartCouponInput");
    if(!list || !badge || !totalEl) return;

    const items = loadCart();
    const currentCoupon = loadCoupon();
    const qtyAll = items.reduce((a, i) => a + i.qty, 0);
    badge.textContent = qtyAll;
    badge.style.display = qtyAll ? "inline-flex" : "none";
    if(inputEl) inputEl.value = currentCoupon ? currentCoupon.code : "";

    list.innerHTML = "";

    if(!items.length){
      list.innerHTML = '<div class="cart-empty">Seu carrinho está vazio.</div>';
      if(subEl) subEl.textContent = brl(0);
      if(discEl) discEl.textContent = `- ${brl(0)}`;
      totalEl.textContent = brl(0);
      if(feedbackEl) feedbackEl.textContent = currentCoupon ? `Cupom ${currentCoupon.code} salvo. Adicione itens para ver o desconto.` : "Use ABERTURA30 para 30% OFF.";
      return;
    }

    items.forEach(it => {
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <img class="cart-item__img" src="${it.img}" alt="${it.name}">
        <div class="cart-item__meta">
          <div class="cart-item__name">${it.name}</div>
          <div class="cart-item__cat">${it.category || ""}</div>
          <div class="cart-item__price">${it.qty}x ${brl(it.price)} = <strong>${brl(it.price * it.qty)}</strong></div>
          <div class="cart-item__qty">
            <button class="qty-btn" data-dec="${it.id}" aria-label="Diminuir">−</button>
            <span class="qty-val">${it.qty}</span>
            <button class="qty-btn" data-inc="${it.id}" aria-label="Aumentar">+</button>
          </div>
        </div>
        <button class="cart-item__trash" data-remove="${it.id}" aria-label="Remover">🗑️</button>`;
      list.appendChild(row);
    });

    const sub = subtotal(items);
    const discount = couponDiscount(sub, currentCoupon);
    const finalTotal = Math.max(0, sub - discount);

    if(subEl) subEl.textContent = brl(sub);
    if(discEl) discEl.textContent = `- ${brl(discount)}`;
    totalEl.textContent = brl(finalTotal);

    if(feedbackEl){
      feedbackEl.textContent = currentCoupon
        ? `Cupom ${currentCoupon.code} aplicado — desconto de ${currentCoupon.type === "percent" ? currentCoupon.value + "%" : brl(currentCoupon.value)}.`
        : "Use ABERTURA30 para 30% OFF.";
    }

    $$('[data-remove]', list).forEach(b => b.addEventListener('click', () => removeItem(b.dataset.remove)));
    $$('[data-inc]', list).forEach(b => b.addEventListener('click', () => changeQty(b.dataset.inc, +1)));
    $$('[data-dec]', list).forEach(b => b.addEventListener('click', () => changeQty(b.dataset.dec, -1)));
  }

  function bindAdd(selector){
    $$(selector).forEach(btn => btn.addEventListener('click', () => addItem({
      id: btn.dataset.id,
      name: btn.dataset.name,
      category: btn.dataset.category || '',
      price: Number(btn.dataset.price || 0),
      img: btn.dataset.img || 'assets/felino-neon.png'
    })));
  }

  function applyCouponFromInput(){
    const input = $("#cartCouponInput");
    const code = normalizeCoupon(input ? input.value : "");
    if(!code){
      saveCoupon(null);
      render();
      toast("Cupom removido.");
      return;
    }
    const coupon = COUPONS[code];
    if(!coupon){
      toast("Cupom inválido.");
      return;
    }
    saveCoupon(coupon);
    render();
    toast(`Cupom ${coupon.code} aplicado!`);
  }

  function init(){
    bindAdd('[data-addcash], [data-addcart]');
    const fab = $("#cartFab");
    const closeBtn = $("#cartClose");
    const overlay = $("#cartOverlay");
    const continueBtn = $("#cartContinue");
    const finishBtn = $("#cartFinish");
    const couponBtn = $("#cartApplyCoupon");
    const couponInput = $("#cartCouponInput");

    if(fab) fab.addEventListener("click", openCart);
    if(closeBtn) closeBtn.addEventListener("click", closeCart);
    if(overlay) overlay.addEventListener("click", closeCart);
    if(continueBtn) continueBtn.addEventListener("click", closeCart);
    if(couponBtn) couponBtn.addEventListener("click", applyCouponFromInput);
    if(couponInput) couponInput.addEventListener("keydown", (e) => {
      if(e.key === "Enter"){
        e.preventDefault();
        applyCouponFromInput();
      }
    });

    if(finishBtn){
      finishBtn.addEventListener("click", async () => {
        const items = loadCart();
        if(!items.length){
          toast("Carrinho vazio.");
          return;
        }
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
