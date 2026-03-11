(function () {
  function $(sel, root=document){ return root.querySelector(sel); }

  function toast(message){
    const el = $('#toast');
    if(!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1700);
  }

  async function copyText(text){
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const t = document.createElement('textarea');
        t.value = text;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        t.remove();
        return true;
      } catch {
        return false;
      }
    }
  }

  function brl(v){
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function getOrderId(){
    const params = new URLSearchParams(window.location.search);
    return params.get('order_id') || localStorage.getItem('redecats_last_order_id') || '';
  }

  function getLocalOrder(orderId){
    if(!orderId) return null;
    try {
      const raw = localStorage.getItem(`redecats_order_${orderId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function fetchOrder(orderId){
    const api = window.RedeCatsAPI || { configured:false };
    if(api.configured){
      const res = await fetch(api.url(`/api/orders/${encodeURIComponent(orderId)}`));
      if(!res.ok) throw new Error('Não foi possível consultar o pedido no backend.');
      return await res.json();
    }
    const local = getLocalOrder(orderId);
    if(!local) throw new Error('Pedido não encontrado no armazenamento local.');
    return local;
  }

  async function simulateApproval(orderId){
    const api = window.RedeCatsAPI || { configured:false };
    if(api.configured){
      const res = await fetch(api.url(`/api/orders/${encodeURIComponent(orderId)}/simulate-approve`), { method:'POST' });
      if(!res.ok) throw new Error('Falha ao simular aprovação no backend.');
      return await res.json();
    }
    const order = getLocalOrder(orderId);
    if(!order) throw new Error('Pedido local não encontrado.');
    order.status = 'approved';
    order.approvedAt = new Date().toISOString();
    localStorage.setItem(`redecats_order_${orderId}`, JSON.stringify(order));
    return order;
  }

  function renderItems(items){
    const wrap = $('#paymentItems');
    wrap.innerHTML = '';
    (items || []).forEach(item => {
      const row = document.createElement('div');
      row.className = 'checkout-item';
      row.innerHTML = `
        <img class="checkout-item__img" src="${item.img}" alt="${item.name}">
        <div class="checkout-item__meta">
          <strong>${item.name}</strong>
          <span>${item.category || 'Produto digital'}</span>
          <small>${item.qty}x ${brl(item.price)} = ${brl(item.qty * item.price)}</small>
        </div>`;
      wrap.appendChild(row);
    });
  }

  function renderOrder(order){
    $('#missingOrder').classList.add('hidden');
    $('#paymentContent').classList.remove('hidden');

    const status = String(order.status || 'pending');
    const paid = status === 'approved';

    $('#paymentStatusBadge').textContent = paid ? 'APROVADO' : 'PENDENTE';
    $('#paymentStatusTitle').textContent = paid ? 'Pagamento confirmado' : 'Aguardando pagamento';
    $('#paymentStatusText').textContent = paid
      ? 'Seu pagamento foi confirmado. A próxima etapa será a entrega automática no servidor.'
      : (order.payment?.instructions || 'Use o código Pix abaixo para concluir o pagamento.');

    $('#paymentOrderId').textContent = order.orderId || '-';
    $('#paymentMethod').textContent = order.paymentMethod || '-';
    $('#paymentCustomer').textContent = order.customer?.playerNick || '-';
    $('#paymentEmail').textContent = order.customer?.email || '-';
    $('#paymentSubtotal').textContent = brl(order.totals?.subtotal || 0);
    $('#paymentDiscount').textContent = `- ${brl(order.totals?.discount || 0)}`;
    $('#paymentTotal').textContent = brl(order.totals?.total || 0);

    renderItems(order.items || []);

    const pixCode = order.payment?.qrCodeText || '';
    const pixArea = $('#pixCode');
    pixArea.value = pixCode;
    const qrWrap = $('#qrCodeWrap');
    qrWrap.innerHTML = pixCode
      ? `<div class="pix-qr-fake"><span>PIX</span><strong>${order.orderId}</strong><small>${brl(order.totals?.total || 0)}</small></div>`
      : '<div class="pix-qr-fake"><span>SEM QR</span></div>';

    const external = $('#externalCheckoutBtn');
    if(order.payment?.externalUrl){
      external.href = order.payment.externalUrl;
      external.classList.remove('hidden');
    } else {
      external.classList.add('hidden');
    }

    const simulateBtn = $('#simulateApprovalBtn');
    simulateBtn.classList.toggle('hidden', paid);
    if(paid){
      $('#paymentInstructions').textContent = 'Pedido confirmado com sucesso.';
    }
  }

  async function init(){
    const orderId = getOrderId();
    if(!orderId) return;
    try {
      const order = await fetchOrder(orderId);
      renderOrder(order);

      $('#copyPixBtn').addEventListener('click', async () => {
        const ok = await copyText($('#pixCode').value || '');
        toast(ok ? 'Código Pix copiado.' : 'Não consegui copiar.');
      });

      $('#simulateApprovalBtn').addEventListener('click', async () => {
        try {
          const updated = await simulateApproval(orderId);
          renderOrder(updated);
          toast('Pedido aprovado em modo de teste.');
        } catch (err) {
          toast(err.message || 'Falha ao aprovar.');
        }
      });
    } catch (err) {
      $('#missingOrder').classList.remove('hidden');
      $('#paymentContent').classList.add('hidden');
      console.error(err);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
