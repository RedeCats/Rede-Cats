(function () {
  const CART = window.RedeCatsCart;

  function $(sel, root=document){ return root.querySelector(sel); }
  function $$(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function toast(message){
    const el = $("#toast");
    if(!el) return;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1600);
  }

  async function copyText(text){
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const t = document.createElement("textarea");
        t.value = text;
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        t.remove();
        return true;
      } catch {
        return false;
      }
    }
  }

  function selectedPayment(){
    const checked = $('input[name="paymentMethod"]:checked');
    return checked ? checked.value : 'pix';
  }

  function paymentLabel(value){
    const labels = {
      pix: 'Pix',
      mercadopago: 'Mercado Pago',
      picpay: 'PicPay'
    };
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
    return {
      items,
      coupon,
      subtotal: sub,
      discount,
      total: Math.max(0, sub - discount)
    };
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
        </div>
      `;
      itemsEl.appendChild(row);
    });

    $('#summarySubtotal').textContent = CART.brl(subtotal);
    $('#summaryDiscount').textContent = `- ${CART.brl(discount)}`;
    $('#summaryTotal').textContent = CART.brl(total);
    couponLabel.textContent = coupon ? coupon.code : 'Nenhum';
    if(feedback){
      feedback.textContent = coupon
        ? `Cupom ${coupon.code} aplicado com sucesso.`
        : 'Use ABERTURA30 para 30% OFF.';
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

  function buildOrderText(formData){
    const { items, coupon, subtotal, discount, total } = currentTotals();
    const lines = [];
    lines.push('🛒 Pedido - Rede Cats');
    lines.push(`Pedido gerado em: ${new Date().toLocaleString('pt-BR')}`);
    lines.push('');
    lines.push('Jogador');
    lines.push(`Nick: ${formData.playerNick}`);
    lines.push(`Nome: ${formData.firstName} ${formData.lastName}`);
    lines.push(`E-mail: ${formData.email}`);
    if(formData.discordNick) lines.push(`Discord: ${formData.discordNick}`);
    if(formData.phone) lines.push(`Telefone: ${formData.phone}`);
    lines.push(`Pagamento desejado: ${paymentLabel(formData.paymentMethod)}`);
    lines.push('');
    lines.push('Itens');
    items.forEach(item => {
      lines.push(`• [${item.category || 'Produto'}] ${item.name} — ${item.qty}x — ${CART.brl(item.qty * item.price)}`);
    });
    lines.push('');
    lines.push(`Subtotal: ${CART.brl(subtotal)}`);
    if(coupon) lines.push(`Cupom: ${coupon.code}`);
    lines.push(`Desconto: -${CART.brl(discount)}`);
    lines.push(`Total: ${CART.brl(total)}`);
    if(formData.notes) {
      lines.push('');
      lines.push(`Observações: ${formData.notes}`);
    }
    lines.push('');
    lines.push('Status atual: checkout visual pronto, aguardando integração do gateway/backend.');
    return lines.join('\n');
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

  function openModal(summaryText){
    $('#orderPreview').textContent = summaryText;
    const modal = $('#orderModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(){
    const modal = $('#orderModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function init(){
    if(!window.RedeCatsCart){
      console.warn('Carrinho da Rede Cats não carregou.');
      return;
    }

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

    $$('.payment-option input').forEach(input => {
      input.addEventListener('change', updatePaymentCards);
    });

    const form = $('#checkoutForm');
    const copyBtn = $('#copyOrderBtn');
    let latestSummary = '';

    function collectData(){
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.paymentMethod = selectedPayment();
      return data;
    }

    if(copyBtn){
      copyBtn.addEventListener('click', async () => {
        if(!validateForm(form)) return;
        latestSummary = buildOrderText(collectData());
        const ok = await copyText(latestSummary);
        toast(ok ? 'Resumo copiado.' : 'Não consegui copiar.');
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if(!validateForm(form)) return;
      latestSummary = buildOrderText(collectData());
      openModal(latestSummary);
      toast('Pedido montado com sucesso.');
    });

    $('#modalCopyBtn').addEventListener('click', async () => {
      if(!latestSummary) return;
      const ok = await copyText(latestSummary);
      toast(ok ? 'Resumo copiado.' : 'Não consegui copiar.');
    });

    $('#closeOrderModal').addEventListener('click', closeModal);
    $('#orderModalOverlay').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') closeModal();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
