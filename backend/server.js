import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, 'storage');
const ORDERS_FILE = path.join(STORAGE_DIR, 'orders.json');
const WEBHOOKS_FILE = path.join(STORAGE_DIR, 'webhooks-last.json');

const MP_API_BASE = 'https://api.mercadopago.com';
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

function mercadopagoConfigured(){
  return !!(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
}

function publicBackendUrl(){
  return (process.env.PUBLIC_BACKEND_URL || '').trim().replace(/\/$/, '');
}

function ensureStorage(){
  if(!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if(!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
  if(!fs.existsSync(WEBHOOKS_FILE)) fs.writeFileSync(WEBHOOKS_FILE, '[]');
}
function readJson(file, fallback){
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data){
  ensureStorage();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function appendJsonEntry(file, entry, maxItems=100){
  const current = readJson(file, []);
  const next = Array.isArray(current) ? current : [];
  next.unshift(entry);
  writeJson(file, next.slice(0, maxItems));
}
function readOrders(){ ensureStorage(); return readJson(ORDERS_FILE, []); }
function writeOrders(data){ writeJson(ORDERS_FILE, data); }
function orderId(){ return `RC-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`; }
function normalizeTotals(totals={}){
  return {
    subtotal: Number(totals.subtotal || 0),
    discount: Number(totals.discount || 0),
    total: Number(totals.total || 0)
  };
}
function nowIso(){ return new Date().toISOString(); }
function digitsOnly(value=''){ return String(value || '').replace(/\D/g, ''); }
function buildFakePix(id, amount){
  return `00020126580014BR.GOV.BCB.PIX0136checkout@redecats.ex520400005303986540${String(Number(amount||0).toFixed(2)).replace(/\D/g,'')}5802BR5920REDE CATS6008GOIANIA62070503***6304${String(id).slice(-4)}`;
}
function makeError(status, message, extra={}){
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}
function saveOrders(orders){
  writeOrders(orders);
  return orders;
}
function findOrder(orderId){
  return readOrders().find(x => x.orderId === orderId) || null;
}
function updateOrder(orderId, updater){
  const orders = readOrders();
  const idx = orders.findIndex(x => x.orderId === orderId);
  if(idx === -1) return null;
  const current = orders[idx];
  const updated = updater(current) || current;
  orders[idx] = updated;
  saveOrders(orders);
  return updated;
}
function paymentStatusToOrderStatus(status=''){
  const normalized = String(status || '').toLowerCase();
  if(normalized === 'approved') return 'approved';
  if(normalized === 'pending' || normalized === 'in_process') return 'pending';
  if(normalized === 'authorized') return 'authorized';
  if(normalized === 'cancelled') return 'cancelled';
  if(normalized === 'rejected') return 'failed';
  if(normalized === 'refunded' || normalized === 'charged_back') return 'refunded';
  return 'pending';
}
function pickWebhookPaymentId(req){
  return String(
    req.body?.data?.id ||
    req.body?.id ||
    req.query?.['data.id'] ||
    req.query?.id ||
    ''
  ).trim();
}
function parseWebhookTopic(req){
  return String(req.body?.type || req.body?.topic || req.query?.type || req.query?.topic || '').trim();
}

async function mercadopagoRequest(pathname, { method='GET', body, headers={} } = {}){
  if(!mercadopagoConfigured()) throw makeError(500, 'Mercado Pago não configurado no backend.');
  const res = await fetch(`${MP_API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if(!res.ok){
    throw makeError(res.status, data.message || data.error || 'Falha na API do Mercado Pago.', { data });
  }
  return data;
}

function buildNotificationUrl(){
  const base = publicBackendUrl();
  return base ? `${base}/api/webhooks/mercadopago` : undefined;
}

function buildMercadoPagoPayload(order){
  const cpf = digitsOnly(order.customer?.cpf || '');
  const payer = {
    email: order.customer.email,
    first_name: order.customer.firstName || order.customer.fullName?.split(' ')[0] || undefined,
    last_name: order.customer.lastName || undefined,
    entity_type: 'individual'
  };
  if(cpf.length === 11){
    payer.identification = { type:'CPF', number: cpf };
  }

  const payload = {
    transaction_amount: Number(order.totals.total.toFixed(2)),
    description: `Pedido ${order.orderId} - Rede Cats`,
    payment_method_id: 'pix',
    payer,
    external_reference: order.orderId,
    notification_url: buildNotificationUrl(),
    metadata: {
      order_id: order.orderId,
      player_nick: order.customer.playerNick,
      site: 'redecats',
      payment_origin: order.paymentMethod || 'pix'
    }
  };

  if(!payload.notification_url) delete payload.notification_url;
  return payload;
}

function mergeMercadoPagoPaymentIntoOrder(order, mpPayment){
  const tx = mpPayment?.point_of_interaction?.transaction_data || {};
  const paymentStatus = String(mpPayment?.status || '').toLowerCase();
  return {
    ...order,
    status: paymentStatusToOrderStatus(paymentStatus),
    approvedAt: paymentStatus === 'approved' ? (mpPayment.date_approved || order.approvedAt || nowIso()) : order.approvedAt,
    payment: {
      ...(order.payment || {}),
      provider: 'mercadopago',
      providerMode: 'pix',
      paymentId: String(mpPayment?.id || order.payment?.paymentId || ''),
      status: mpPayment?.status || order.payment?.status || 'pending',
      statusDetail: mpPayment?.status_detail || order.payment?.statusDetail || '',
      qrCodeText: tx?.qr_code || order.payment?.qrCodeText || '',
      qrCodeBase64: tx?.qr_code_base64 || order.payment?.qrCodeBase64 || '',
      externalUrl: tx?.ticket_url || order.payment?.externalUrl || '',
      dateOfExpiration: mpPayment?.date_of_expiration || order.payment?.dateOfExpiration || '',
      rawLastSyncAt: nowIso(),
      instructions: paymentStatus === 'approved'
        ? 'Pagamento confirmado pelo Mercado Pago.'
        : 'Use o QR Code Pix ou o código copia e cola gerado pelo Mercado Pago para concluir o pagamento.'
    }
  };
}

async function createMercadoPagoPixPayment(order){
  const payload = buildMercadoPagoPayload(order);
  const mpPayment = await mercadopagoRequest('/v1/payments', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    body: payload
  });
  return mergeMercadoPagoPaymentIntoOrder(order, mpPayment);
}

async function refreshOrderFromMercadoPago(order){
  const paymentId = String(order?.payment?.paymentId || '').trim();
  if(!paymentId) return order;
  const mpPayment = await mercadopagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
  return mergeMercadoPagoPaymentIntoOrder(order, mpPayment);
}

function createBaseOrder(body){
  const cart = Array.isArray(body.cart) ? body.cart : [];
  const customer = body.customer || {};
  const totals = normalizeTotals(body.totals);

  if(!cart.length) throw makeError(400, 'Carrinho vazio.');
  if(!customer.playerNick || !customer.email || !customer.fullName) throw makeError(400, 'Dados do comprador incompletos.');
  if(totals.total <= 0) throw makeError(400, 'Total inválido para criação do pedido.');

  return {
    orderId: orderId(),
    status: 'pending',
    mode: mercadopagoConfigured() ? 'mercadopago-pix' : 'backend-demo',
    createdAt: nowIso(),
    paymentMethod: body.paymentMethod || 'pix',
    customer: {
      playerNick: customer.playerNick,
      email: customer.email,
      fullName: customer.fullName,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      discordNick: customer.discordNick || '',
      phone: customer.phone || '',
      cpf: digitsOnly(customer.cpf || ''),
      notes: customer.notes || ''
    },
    items: cart,
    coupon: body.coupon || null,
    totals,
    payment: {
      provider: mercadopagoConfigured() ? 'mercadopago' : 'mercadopago-demo',
      providerMode: 'pix',
      expiresInMinutes: 30,
      qrCodeText: buildFakePix(Date.now(), totals.total),
      qrCodeBase64: '',
      externalUrl: '',
      status: 'pending',
      statusDetail: '',
      instructions: mercadopagoConfigured()
        ? 'Criando o Pix real do Mercado Pago...'
        : 'Backend próprio funcionando. Falta apenas ligar o token do Mercado Pago no servidor.'
    }
  };
}

const app = express();
app.use(cors({ origin: FRONTEND_ORIGINS.length ? FRONTEND_ORIGINS : true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'redecats-store-backend',
    time: nowIso(),
    mercadopagoConfigured: mercadopagoConfigured(),
    publicBackendUrl: publicBackendUrl() || null
  });
});

app.post('/api/orders', async (req, res, next) => {
  try {
    let order = createBaseOrder(req.body || {});
    if(mercadopagoConfigured() && (order.paymentMethod === 'pix' || order.paymentMethod === 'mercadopago')){
      order = await createMercadoPagoPixPayment(order);
    }
    const orders = readOrders();
    orders.push(order);
    saveOrders(orders);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

app.get('/api/orders/:orderId', async (req, res, next) => {
  try {
    let order = findOrder(req.params.orderId);
    if(!order) throw makeError(404, 'Pedido não encontrado.');

    const wantsRefresh = String(req.query.refresh || '').trim() === '1';
    if(wantsRefresh && mercadopagoConfigured() && order.payment?.paymentId){
      order = await refreshOrderFromMercadoPago(order);
      updateOrder(order.orderId, () => order);
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
});

app.post('/api/orders/:orderId/refresh-payment', async (req, res, next) => {
  try {
    let order = findOrder(req.params.orderId);
    if(!order) throw makeError(404, 'Pedido não encontrado.');
    if(!mercadopagoConfigured()) throw makeError(400, 'Mercado Pago ainda não foi configurado no backend.');
    if(!order.payment?.paymentId) throw makeError(400, 'Este pedido ainda não tem paymentId do Mercado Pago.');
    order = await refreshOrderFromMercadoPago(order);
    updateOrder(order.orderId, () => order);
    res.json(order);
  } catch (err) {
    next(err);
  }
});

app.post('/api/orders/:orderId/simulate-approve', (req, res) => {
  const orders = readOrders();
  const order = orders.find(x => x.orderId === req.params.orderId);
  if(!order) return res.status(404).json({ error:'Pedido não encontrado.' });
  order.status = 'approved';
  order.payment = {
    ...(order.payment || {}),
    status: 'approved',
    statusDetail: 'accredited',
    instructions: 'Pagamento confirmado em modo de teste.'
  };
  order.approvedAt = nowIso();
  saveOrders(orders);
  res.json(order);
});

app.post('/api/webhooks/mercadopago', async (req, res) => {
  const entry = {
    receivedAt: nowIso(),
    headers: req.headers,
    query: req.query,
    body: req.body || {}
  };
  appendJsonEntry(WEBHOOKS_FILE, entry, 200);

  const topic = parseWebhookTopic(req);
  const paymentId = pickWebhookPaymentId(req);

  if(topic && topic !== 'payment' && topic !== 'merchant_order'){
    return res.status(200).json({ received:true, ignored:true, topic });
  }

  if(!mercadopagoConfigured() || !paymentId){
    return res.status(200).json({ received:true, queued:false });
  }

  try {
    const mpPayment = await mercadopagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
    const externalReference = String(mpPayment?.external_reference || '').trim();
    if(!externalReference){
      return res.status(200).json({ received:true, synced:false, reason:'missing-external-reference' });
    }

    const updated = updateOrder(externalReference, (current) => mergeMercadoPagoPaymentIntoOrder(current, mpPayment));
    return res.status(200).json({
      received: true,
      synced: !!updated,
      orderId: updated?.orderId || null,
      paymentId: String(mpPayment?.id || paymentId)
    });
  } catch (error) {
    return res.status(200).json({ received:true, synced:false, error:error.message || 'Webhook sync failed.' });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = Number(err.status || 500);
  res.status(status).json({
    error: err.message || 'Erro interno do servidor.',
    details: err.data || undefined
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  ensureStorage();
  console.log(`Rede Cats backend em http://localhost:${port}`);
});
