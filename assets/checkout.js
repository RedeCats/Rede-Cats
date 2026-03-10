(function () {
  const CART = window.RedeCatsCart;
  const API_CONFIG = window.RedeCatsApiConfig || {};
  const PAYMENT_SESSION_KEY = 'redecats_payment_session_v1';

  function $(sel, root=document){ return root.querySelector(sel); }
  function $$(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function toast(message){
    const el = $("#toast");
    if(!el) return;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1800);
  }

  function selectedPayment(){
    const checked = $('input[name="paymentMethod"]:checked');
    return checked ? checked.value : 'pix';
  }

  function paymentLabel(value){
    const labels = { pix: 'Pix', mercadopago: 'Mercado Pago', picpay: 'PicPay' };
    return labels[value] || value;
  }

  function subtotal(items){
    return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  }

  function currentTotals(){
    const items = CART.loadCart();
    const coupon = CART.loadCoupon();
    const sub = subtotal(items);
    const discount = CART.couponDiscount(sub, coupon);
    return { items, coupon, subtotal: sub, discount, total: Math.max(0, sub - discount) };
  }

  function renderSummary(){
    const { items, coupon, subtotal, discount, total } = currentTotals();
    const itemsEl = $('#checkoutItems');
    const emptyEl = $('#checkoutEmptyState');
    const contentEl = $('#checkoutSummaryContent');
    const couponLabel = $('#checkoutCouponLabel');
    const couponInput = $('#couponCode');
    const feedback = $('#checkoutCouponFeedback');

    if(couponInput) couponInput.value = coupon ? coupon.code : '';

    if(!items.length){
      emptyEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    itemsEl.innerHTML = '';

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'checkout-item';
      row.innerHTML = `
        <img class="checkout-item__img" src="${item.img}" alt="${item.name}">
        <div class="checkout-item__meta">
          <strong>${item.name}</strong>
          <span>${item.category || 'Produto digital'}</span>
          <small>${item.qty}x ${CART.brl(item.price)} = ${CART.brl(item.qty * item.price)}</small>
        </div>`;
      itemsEl.appendChild(row);
    });

    $('#summarySubtotal').textContent = CART.brl(subtotal);
    $('#summaryDiscount').textContent = `- ${CART.brl(discount)}`;
    $('#summaryTotal').textContent = CART.brl(total);
    couponLabel.textContent = coupon ? coupon.code : 'Nenhum';
    if(feedback){
      feedback.textContent = coupon ? `Cupom ${coupon.code} aplicado com sucesso.` : 'Use ABERTURA30 para 30% OFF.';
    }
  }

  function applyCoupon(){
    const input = $('#couponCode');
    const code = CART.normalizeCoupon(input ? input.value : '');
    if(!code){
      CART.saveCoupon(null);
      renderSummary();
      toast('Cupom removido.');
      return;
    }
    const coupon = CART.coupons[code];
    if(!coupon){
      toast('Cupom inválido.');
      return;
    }
    CART.saveCoupon(coupon);
    renderSummary();
    toast(`Cupom ${coupon.code} aplicado.`);
  }

  function updatePaymentCards(){
    $$('.payment-option').forEach(label => {
      const input = $('input', label);
      label.classList.toggle('is-active', !!input.checked);
    });
  }

  function validateForm(form){
    if(!form.reportValidity()) return false;
    const items = CART.loadCart();
    if(!items.length){
      toast('Seu carrinho está vazio.');
      return false;
    }
    if(!$('#terms').checked){
      toast('Aceite os termos para continuar.');
      return false;
    }
    return true;
  }

  function apiBase(){
    return String(API_CONFIG.apiBaseUrl || '').trim().replace(/\/$/, '');
  }

  function getFormData(form){
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    data.paymentMethod = selectedPayment();
    return data;
  }

  function makeOrderPayload(formData){
    const { items, coupon, subtotal, discount, total } = currentTotals();
    return {
      customer: {
        playerNick: formData.playerNick,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        discordNick: formData.discordNick || '',
        phone: formData.phone || '',
        notes: formData.notes || ''
      },
      paymentMethod: formData.paymentMethod,
      coupon: coupon ? coupon.code : null,
      cart: items,
      totals: { subtotal, discount, total }
    };
  }

  function generateMockPixCode(order){
    const amount = Number(order?.totals?.total || 0).toFixed(2);
    const id = order.orderId || `RC${Date.now()}`;
    return `00020126580014BR.GOV.BCB.PIX0136checkout@redecats.ex520400005303986540${amount.replace('.', '')}5802BR5920REDE CATS6008GOIANIA62070503***6304${id.slice(-4)}`;
  }

  function persistPaymentSession(orderResponse){
    localStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(orderResponse));
  }

  async function submitOrder(payload){
    const base = apiBase();
    if(!base){
      const fakeOrderId = `RC-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
      const response = {
        mode: 'demo',
        orderId: fakeOrderId,
        status: 'pending',
        storeName: API_CONFIG.storeName || 'Rede Cats',
        supportUrl: API_CONFIG.supportUrl || 'https://discord.gg/GQZGduc9',
        createdAt: new Date().toISOString(),
        paymentMethod: payload.paymentMethod,
        customer: payload.customer,
        items: payload.cart,
        coupon: payload.coupon,
        totals: payload.totals,
        payment: {
          expiresInMinutes: 30,
          qrCodeText: generateMockPixCode({ orderId: fakeOrderId, totals: payload.totals }),
          qrCodeBase64: '',
          externalUrl: payload.paymentMethod === 'mercadopago' ? 'https://www.mercadopago.com.br/' : '',
          instructions: payload.paymentMethod === 'pix'
            ? 'Modo demonstração: conecte o backend para gerar QR Pix real do Mercado Pago.'
            : 'Modo demonstração: conecte o backend para abrir o checkout real.'
        }
      };
      return response;
    }

    const res = await fetch(`${base}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(data.error || 'Falha ao criar o pedido.');
    return data;
  }

  async function handleSubmit(form, submitBtn){
    if(!validateForm(form)) return;
    const oldText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando pedido...';

    try {
      const payload = makeOrderPayload(getFormData(form));
      const orderResponse = await submitOrder(payload);
      persistPaymentSession(orderResponse);
      window.location.href = 'payment.html';
    } catch (err) {
      console.error(err);
      toast(err.message || 'Erro ao criar pedido.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = oldText;
    }
  }

  function init(){
    if(!window.RedeCatsCart) return;
    renderSummary();
    updatePaymentCards();

    const couponBtn = $('#applyCheckoutCoupon');
    const couponInput = $('#couponCode');
    const form = $('#checkoutForm');
    const submitBtn = $('#placeOrderBtn');
    const backendStatus = $('#backendStatus');
    const apiInfo = apiBase();
    if(backendStatus){
      backendStatus.textContent = apiInfo
        ? `Backend configurado: ${apiInfo}`
        : 'Modo demonstração ativo. Configure assets/api-config.js e suba o backend para pagamentos reais.';
    }

    if(couponBtn) couponBtn.addEventListener('click', applyCoupon);
    if(couponInput) couponInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        applyCoupon();
      }
    });

    $$('.payment-option input').forEach(input => input.addEventListener('change', updatePaymentCards));

    $('#copyOrderBtn')?.addEventListener('click', async () => {
      if(!validateForm(form)) return;
      const payload = makeOrderPayload(getFormData(form));
      const summary = JSON.stringify(payload, null, 2);
      try {
        await navigator.clipboard.writeText(summary);
        toast('Resumo técnico copiado.');
      } catch {
        toast('Não consegui copiar.');
      }
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSubmit(form, submitBtn);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
