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

  function persistLocalOrder(order){
    if(!order?.orderId) return;
    localStorage.setItem(`redecats_order_${order.orderId}`, JSON.stringify(order));
    localStorage.setItem('redecats_last_order_id', order.orderId);
  }

  async function fetchOrder(orderId, refresh=false){
    const api = window.RedeCatsAPI || { configured:false };
    if(api.configured){
      const path = `/api/orders/${encodeURIComponent(orderId)}${refresh ? '?refresh=1' : ''}`;
      const res = await fetch(api.url(path));
      if(!res.ok) throw new Error('Não foi possível consultar o pedido no backend.');
      return await res.json();
    }
    const local = getLocalOrder(orderId);
    if(!local) throw new Error('Pedido não encontrado no armazenamento local.');
    return local;
  }

  async function refreshPayment(orderId){
    const api = window.RedeCatsAPI || { configured:false };
    if(api.configured){
      const res = await fetch(api.url(`/api/orders/${encodeURIComponent(orderId)}/refresh-payment`), { method:'POST' });
      if(!res.ok){
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Não consegui atualizar o status do pagamento.');
      }
      return await res.json();
    }
    const order = getLocalOrder(orderId);
    if(!order) throw new Error('Pedido local não encontrado.');
    return order;
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
    order.payment = {
      ...(order.payment || {}),
      status: 'approved',
      statusDetail: 'accredited',
      instructions: 'Pagamento confirmado em modo de teste.'
    };
    order.approvedAt = new Date().toISOString();
    order.delivery = {
      status: 'needs_backend',
      totalJobs: order.items?.length || 0,
      counts: { pending:0, processing:0, delivered:0, failed:0, needs_config:0 },
      jobs: []
    };
    persistLocalOrder(order);
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

  function statusBadgeText(status){
    const v = String(status || '').toLowerCase();
    if(v === 'approved') return 'APROVADO';
    if(v === 'authorized') return 'AUTORIZADO';
    if(v === 'failed') return 'FALHOU';
    if(v === 'cancelled') return 'CANCELADO';
    if(v === 'refunded') return 'ESTORNADO';
    return 'PENDENTE';
  }

  function statusTitle(status){
    const v = String(status || '').toLowerCase();
    if(v === 'approved') return 'Pagamento confirmado';
    if(v === 'authorized') return 'Pagamento autorizado';
    if(v === 'failed') return 'Pagamento não aprovado';
    if(v === 'cancelled') return 'Pagamento cancelado';
    if(v === 'refunded') return 'Pagamento estornado';
    return 'Aguardando pagamento';
  }

  function deliveryStatusText(delivery){
    const v = String(delivery?.status || '').toLowerCase();
    if(v === 'delivered') return 'Entrega concluída';
    if(v === 'queued') return 'Na fila de entrega';
    if(v === 'failed') return 'Falha na entrega';
    if(v === 'needs_config') return 'Catálogo precisa ser revisado';
    if(v === 'needs_backend') return 'Configure o backend para automatizar';
    return 'Aguardando pagamento';
  }

  function renderDelivery(order){
    const delivery = order.delivery || { status:'not_generated', totalJobs:0, counts:{} };
    $('#deliveryStatusText').textContent = deliveryStatusText(delivery);
    $('#deliveryJobsCount').textContent = String(delivery.totalJobs || 0);
    $('#deliveryDeliveredCount').textContent = String(delivery.counts?.delivered || 0);

    const meta = $('#deliveryMetaInfo');
    const pills = [];
    const counts = delivery.counts || {};
    if(delivery.status === 'queued') pills.push(`📦 ${counts.pending || 0} aguardando bridge`);
    if(counts.processing) pills.push(`⚙️ ${counts.processing} em processamento`);
    if(counts.failed) pills.push(`❌ ${counts.failed} com falha`);
    if(counts.needs_config) pills.push(`🛠️ ${counts.needs_config} precisam de ajuste no catálogo`);
    if(delivery.status === 'delivered') pills.push('✅ Todos os itens já foram entregues');
    if(!pills.length) pills.push('📦 A fila de entrega será criada após a aprovação');
    meta.innerHTML = pills.map(v => `<div class="trust-pill">${v}</div>`).join('');
  }

  function renderQr(order){
    const qrWrap = $('#qrCodeWrap');
    const base64 = order.payment?.qrCodeBase64 || '';
    const pixCode = order.payment?.qrCodeText || '';
    if(base64){
      qrWrap.innerHTML = `<img class="pix-qr-img" alt="QR Code Pix" src="data:image/png;base64,${base64}">`;
      return;
    }
    qrWrap.innerHTML = pixCode
      ? `<div class="pix-qr-fake"><span>PIX</span><strong>${order.orderId}</strong><small>${brl(order.totals?.total || 0)}</small></div>`
      : '<div class="pix-qr-fake"><span>SEM QR</span></div>';
  }

  function renderOrder(order){
    persistLocalOrder(order);
    $('#missingOrder').classList.add('hidden');
    $('#paymentContent').classList.remove('hidden');

    const paid = String(order.status || '').toLowerCase() === 'approved';
    $('#paymentStatusBadge').textContent = statusBadgeText(order.status);
    $('#paymentStatusTitle').textContent = statusTitle(order.status);
    $('#paymentStatusText').textContent = paid
      ? 'Seu pagamento foi confirmado. A fila de entrega já pode ser enviada para o servidor.'
      : (order.payment?.instructions || 'Use o código Pix abaixo para concluir o pagamento.');

    $('#paymentOrderId').textContent = order.orderId || '-';
    $('#paymentMethod').textContent = order.paymentMethod || '-';
    $('#paymentCustomer').textContent = order.customer?.playerNick || '-';
    $('#paymentEmail').textContent = order.customer?.email || '-';
    $('#paymentSubtotal').textContent = brl(order.totals?.subtotal || 0);
    $('#paymentDiscount').textContent = `- ${brl(order.totals?.discount || 0)}`;
    $('#paymentTotal').textContent = brl(order.totals?.total || 0);

    renderItems(order.items || []);
    renderDelivery(order);
    $('#pixCode').value = order.payment?.qrCodeText || '';
    renderQr(order);

    const external = $('#externalCheckoutBtn');
    if(order.payment?.externalUrl){
      external.href = order.payment.externalUrl;
      external.classList.remove('hidden');
    } else {
      external.classList.add('hidden');
    }

    const refreshBtn = $('#refreshPaymentBtn');
    if(refreshBtn){
      refreshBtn.classList.toggle('hidden', paid && String(order.delivery?.status || '') === 'delivered');
    }

    const simulateBtn = $('#simulateApprovalBtn');
    const localMode = !((window.RedeCatsAPI || {}).configured);
    simulateBtn.classList.toggle('hidden', paid || !localMode);

    const trust = $('#paymentMetaInfo');
    if(trust){
      const details = [];
      if(order.payment?.provider === 'mercadopago') details.push('🔗 Pix gerado pelo Mercado Pago');
      else details.push('🧪 Modo de teste local');
      if(order.payment?.paymentId) details.push(`🆔 paymentId ${order.payment.paymentId}`);
      if(order.payment?.dateOfExpiration) details.push(`⏳ expira em ${new Date(order.payment.dateOfExpiration).toLocaleString('pt-BR')}`);
      if(order.delivery?.status === 'delivered') details.push('🎁 Entrega concluída no servidor');
      trust.innerHTML = details.map(v => `<div class="trust-pill">${v}</div>`).join('');
    }
  }

  async function init(){
    const orderId = getOrderId();
    if(!orderId) return;
    try {
      const order = await fetchOrder(orderId, true);
      renderOrder(order);

      $('#copyPixBtn').addEventListener('click', async () => {
        const ok = await copyText($('#pixCode').value || '');
        toast(ok ? 'Código Pix copiado.' : 'Não consegui copiar.');
      });

      $('#refreshPaymentBtn')?.addEventListener('click', async () => {
        try {
          const updated = await refreshPayment(orderId);
          renderOrder(updated);
          toast('Status atualizado.');
        } catch (err) {
          toast(err.message || 'Não consegui atualizar.');
        }
      });

      $('#simulateApprovalBtn')?.addEventListener('click', async () => {
        try {
          const updated = await simulateApproval(orderId);
          renderOrder(updated);
          toast('Pedido aprovado em modo de teste.');
        } catch (err) {
          toast(err.message || 'Falha ao aprovar.');
        }
      });

      if((window.RedeCatsAPI || {}).configured && String(order.status || '').toLowerCase() !== 'approved'){
        let attempts = 0;
        const timer = setInterval(async () => {
          attempts += 1;
          if(attempts > 20){
            clearInterval(timer);
            return;
          }
          try {
            const updated = await refreshPayment(orderId);
            renderOrder(updated);
            const done = String(updated.status || '').toLowerCase() === 'approved' && ['queued','delivered','needs_config'].includes(String(updated.delivery?.status || '').toLowerCase());
            if(done) clearInterval(timer);
          } catch {}
        }, 15000);
      }
    } catch (err) {
      $('#missingOrder').classList.remove('hidden');
      $('#paymentContent').classList.add('hidden');
      console.error(err);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
