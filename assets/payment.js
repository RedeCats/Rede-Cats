(function () {
  const KEY = 'redecats_payment_session_v1';

  function $(sel, root=document){ return root.querySelector(sel); }

  function brl(v){
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function loadSession(){
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch { return null; }
  }

  async function copyText(text){
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function setStatus(status, mode){
    const badge = $('#paymentStatusBadge');
    const title = $('#paymentStatusTitle');
    const text = $('#paymentStatusText');
    if(!badge || !title || !text) return;

    if(status === 'approved'){
      badge.textContent = 'PAGO';
      title.textContent = 'Pagamento aprovado';
      text.textContent = 'Pedido confirmado. Na fase final, este status virá do webhook do gateway e poderá liberar a entrega automática no servidor.';
      return;
    }

    badge.textContent = mode === 'demo' ? 'DEMO' : 'PENDENTE';
    title.textContent = 'Aguardando pagamento';
    text.textContent = mode === 'demo'
      ? 'Você está vendo o fluxo em modo demonstração. Quando o backend estiver online, esta tela mostrará o QR Pix real ou o link externo de checkout.'
      : 'Pedido criado. Aguarde a compensação ou finalize no checkout externo.';
  }

  function render(){
    const data = loadSession();
    if(!data){
      $('#missingOrder').classList.remove('hidden');
      $('#paymentContent').classList.add('hidden');
      return;
    }

    $('#missingOrder').classList.add('hidden');
    $('#paymentContent').classList.remove('hidden');

    setStatus(data.status, data.mode);
    $('#paymentOrderId').textContent = data.orderId || '-';
    $('#paymentMethod').textContent = (data.paymentMethod || '-').toUpperCase();
    $('#paymentCustomer').textContent = data.customer?.playerNick || '-';
    $('#paymentEmail').textContent = data.customer?.email || '-';
    $('#paymentTotal').textContent = brl(data.totals?.total || 0);
    $('#paymentSubtotal').textContent = brl(data.totals?.subtotal || 0);
    $('#paymentDiscount').textContent = `- ${brl(data.totals?.discount || 0)}`;
    $('#paymentInstructions').textContent = data.payment?.instructions || 'Siga as instruções do pagamento.';

    const itemsEl = $('#paymentItems');
    itemsEl.innerHTML = '';
    (data.items || []).forEach(item => {
      const row = document.createElement('div');
      row.className = 'checkout-item';
      row.innerHTML = `
        <img class="checkout-item__img" src="${item.img}" alt="${item.name}">
        <div class="checkout-item__meta">
          <strong>${item.name}</strong>
          <span>${item.category || 'Produto digital'}</span>
          <small>${item.qty}x ${brl(item.price)} = ${brl(item.qty * item.price)}</small>
        </div>`;
      itemsEl.appendChild(row);
    });

    const qrText = data.payment?.qrCodeText || '';
    $('#pixCode').value = qrText;
    const qrWrap = $('#qrCodeWrap');
    if(data.payment?.qrCodeBase64){
      qrWrap.innerHTML = `<img class="pix-qr-image" src="data:image/png;base64,${data.payment.qrCodeBase64}" alt="QR Code Pix">`;
    } else {
      qrWrap.innerHTML = `<div class="pix-qr-placeholder"><strong>QR Pix</strong><small>${data.mode === 'demo' ? 'Demonstração' : 'Aguardando imagem do gateway'}</small></div>`;
    }

    const externalLink = $('#externalCheckoutBtn');
    if(data.payment?.externalUrl){
      externalLink.href = data.payment.externalUrl;
      externalLink.classList.remove('hidden');
    } else {
      externalLink.classList.add('hidden');
    }

    $('#copyPixBtn')?.addEventListener('click', async () => {
      const ok = await copyText(qrText);
      const toast = $('#toast');
      toast.textContent = ok ? 'Código Pix copiado.' : 'Não consegui copiar.';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 1500);
    });

    $('#simulateApprovalBtn')?.addEventListener('click', () => {
      data.status = 'approved';
      localStorage.setItem(KEY, JSON.stringify(data));
      setStatus('approved', data.mode);
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
