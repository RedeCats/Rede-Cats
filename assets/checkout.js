(function () {
  const CART = window.RedeCatsCart;

  function $(sel, root=document){ return root.querySelector(sel); }
  function $$(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function toast(message){
    const el = $('#toast');
    if(!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1700);
  }

  function paymentLabel(value){
    return ({ pix:'Pix', mercadopago:'Mercado Pago', picpay:'PicPay' })[value] || value;
  }

  function currentTotals(){
    const items = CART.loadCart();
    const coupon = CART.loadCoupon();
    const subtotal = CART.subtotal(items);
    const discount = CART.couponDiscount(subtotal, coupon);
    const total = Math.max(0, subtotal - discount);
    return { items, coupon, subtotal, discount, total };
  }

  function renderSummary(){
    const { items, coupon, subtotal, discount, total } = currentTotals();
    const itemsEl = $('#checkoutItems');
    const emptyEl = $('#checkoutEmptyState');
    const contentEl = $('#checkoutSummaryContent');
    const couponLabel = $('#checkoutCouponLabel');
    const couponInput = $('#couponCode');
    const feedback = $('#checkoutCouponFeedback');
    const backendStatus = $('#backendStatus');
    const api = window.RedeCatsAPI || { configured:false };

    if(couponInput) couponInput.value = coupon ? coupon.code : '';
    if(backendStatus) backendStatus.textContent = api.configured ? 'Backend conectado.' : 'Modo demonstração local ativo.';

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
    if(couponLabel) couponLabel.textContent = coupon ? coupon.code : 'Nenhum';
    if(feedback) feedback.textContent = coupon ? `Cupom ${coupon.code} aplicado com sucesso.` : 'Use ABERTURA30 para 30% OFF.';
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

  function selectedPayment(){
    const checked = $('input[name="paymentMethod"]:checked');
    return checked ? checked.value : 'pix';
  }

  function validateForm(form){
    if(!form.reportValidity()) return false;
    if(!CART.loadCart().length){
      toast('Seu carrinho está vazio.');
      return false;
    }
    if(!$('#terms').checked){
      toast('Aceite os termos para continuar.');
      return false;
    }
    return true;
  }

  function collectData(form){
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    return {
      playerNick: data.playerNick || '',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      email: data.email || '',
      discordNick: data.discordNick || '',
      phone: data.phone || '',
      cpf: data.cpf || '',
      notes: data.notes || '',
      paymentMethod: selectedPayment()
    };
  }

  function persistLocalOrder(order){
    localStorage.setItem(`redecats_order_${order.orderId}`, JSON.stringify(order));
    localStorage.setItem('redecats_last_order_id', order.orderId);
  }

  function makeLocalOrder(customer){
    const { items, coupon, subtotal, discount, total } = currentTotals();
    const orderId = `RC-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
    return {
      orderId,
      status: 'pending',
      mode: 'local-demo',
      createdAt: new Date().toISOString(),
      paymentMethod: customer.paymentMethod,
      customer,
      items,
      coupon: coupon || null,
      totals: { subtotal, discount, total },
      payment: {
        expiresInMinutes: 30,
        qrCodeText: `00020126580014BR.GOV.BCB.PIX0136checkout@redecats.ex520400005303986540${String(total.toFixed(2)).replace(/\D/g,'')}5802BR5920REDE CATS6008GOIANIA62070503***6304${orderId.slice(-4)}`,
        qrCodeBase64: '',
        externalUrl: customer.paymentMethod === 'mercadopago' ? 'https://www.mercadopago.com.br/' : '',
        instructions: 'Pedido criado em modo local. Na próxima etapa, o Pix real virá do Mercado Pago.'
      }
    };
  }

  async function createRemoteOrder(payload){
    const api = window.RedeCatsAPI || { configured:false };
    if(!api.configured) return null;
    const res = await fetch(api.url('/api/orders'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if(!res.ok){
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Falha ao criar o pedido no backend.');
    }
    return await res.json();
  }

  async function createOrder(form){
    const customer = collectData(form);
    const { items, coupon, subtotal, discount, total } = currentTotals();
    const payload = {
      customer,
      cart: items,
      coupon,
      paymentMethod: customer.paymentMethod,
      totals: { subtotal, discount, total }
    };

    const remote = await createRemoteOrder(payload);
    const order = remote || makeLocalOrder(customer);
    persistLocalOrder(order);
    return order;
  }

  function init(){
    if(!CART) return;
    renderSummary();
    updatePaymentCards();

    const couponBtn = $('#applyCheckoutCoupon');
    const couponInput = $('#couponCode');
    if(couponBtn) couponBtn.addEventListener('click', applyCoupon);
    if(couponInput) couponInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        applyCoupon();
      }
    });

    $$('.payment-option input').forEach(input => input.addEventListener('change', updatePaymentCards));

    const form = $('#checkoutForm');
    const copyBtn = $('#copyOrderBtn');

    copyBtn?.addEventListener('click', async () => {
      if(!validateForm(form)) return;
      const customer = collectData(form);
      const { items, coupon, subtotal, discount, total } = currentTotals();
      const text = [
        '🛒 Pedido - Rede Cats',
        `Nick: ${customer.playerNick}`,
        `Nome: ${customer.fullName}`,
        `E-mail: ${customer.email}`,
        `Pagamento: ${paymentLabel(customer.paymentMethod)}`,
        '',
        ...items.map(item => `• ${item.name} — ${item.qty}x — ${CART.brl(item.qty * item.price)}`),
        '',
        `Subtotal: ${CART.brl(subtotal)}`,
        `Cupom: ${coupon ? coupon.code : 'Nenhum'}`,
        `Desconto: -${CART.brl(discount)}`,
        `Total: ${CART.brl(total)}`
      ].join('\n');
      try {
        await navigator.clipboard.writeText(text);
        toast('Resumo copiado.');
      } catch {
        toast('Não consegui copiar.');
      }
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if(!validateForm(form)) return;
      const btn = $('#placeOrderBtn');
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Criando pedido...';
      try {
        const order = await createOrder(form);
        window.location.href = `payment.html?order_id=${encodeURIComponent(order.orderId)}`;
      } catch (err) {
        console.error(err);
        toast(err.message || 'Não foi possível criar o pedido.');
      } finally {
        btn.disabled = false;
        btn.textContent = old;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
