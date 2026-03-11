import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, 'storage');
const ORDERS_FILE = path.join(STORAGE_DIR, 'orders.json');
const WEBHOOKS_FILE = path.join(STORAGE_DIR, 'webhooks-last.json');

function ensureStorage(){
  if(!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if(!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
}
function readJson(file, fallback){
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data){
  ensureStorage();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function readOrders(){ ensureStorage(); return readJson(ORDERS_FILE, []); }
function writeOrders(data){ writeJson(ORDERS_FILE, data); }
function orderId(){ return `RC-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`; }
function pixCode(id, amount){ return `00020126580014BR.GOV.BCB.PIX0136checkout@redecats.ex520400005303986540${String(Number(amount||0).toFixed(2)).replace(/\D/g,'')}5802BR5920REDE CATS6008GOIANIA62070503***6304${String(id).slice(-4)}`; }
function normalizeTotals(totals={}){
  return {
    subtotal: Number(totals.subtotal || 0),
    discount: Number(totals.discount || 0),
    total: Number(totals.total || 0)
  };
}

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok:true, service:'redecats-store-backend', time:new Date().toISOString() });
});

app.post('/api/orders', (req, res) => {
  const body = req.body || {};
  const cart = Array.isArray(body.cart) ? body.cart : [];
  const customer = body.customer || {};
  const totals = normalizeTotals(body.totals);

  if(!cart.length) return res.status(400).json({ error:'Carrinho vazio.' });
  if(!customer.playerNick || !customer.email || !customer.fullName) return res.status(400).json({ error:'Dados do comprador incompletos.' });

  const createdOrder = {
    orderId: orderId(),
    status: 'pending',
    mode: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'gateway-ready' : 'backend-demo',
    createdAt: new Date().toISOString(),
    paymentMethod: body.paymentMethod || 'pix',
    customer: {
      playerNick: customer.playerNick,
      email: customer.email,
      fullName: customer.fullName,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      discordNick: customer.discordNick || '',
      phone: customer.phone || '',
      notes: customer.notes || ''
    },
    items: cart,
    coupon: body.coupon || null,
    totals,
    payment: {
      provider: 'mercadopago-ready',
      expiresInMinutes: 30,
      qrCodeText: pixCode(Date.now(), totals.total),
      qrCodeBase64: '',
      externalUrl: body.paymentMethod === 'mercadopago' ? 'https://www.mercadopago.com.br/' : '',
      instructions: process.env.MERCADOPAGO_ACCESS_TOKEN
        ? 'Backend pronto para o próximo passo: criar o Pix real do Mercado Pago e confirmar via webhook.'
        : 'Backend próprio funcionando. Falta apenas ligar o Pix real do Mercado Pago.'
    }
  };

  const orders = readOrders();
  orders.push(createdOrder);
  writeOrders(orders);
  res.status(201).json(createdOrder);
});

app.get('/api/orders/:orderId', (req, res) => {
  const order = readOrders().find(x => x.orderId === req.params.orderId);
  if(!order) return res.status(404).json({ error:'Pedido não encontrado.' });
  res.json(order);
});

app.post('/api/orders/:orderId/simulate-approve', (req, res) => {
  const orders = readOrders();
  const order = orders.find(x => x.orderId === req.params.orderId);
  if(!order) return res.status(404).json({ error:'Pedido não encontrado.' });
  order.status = 'approved';
  order.approvedAt = new Date().toISOString();
  writeOrders(orders);
  res.json(order);
});

app.post('/api/webhooks/mercadopago', (req, res) => {
  writeJson(WEBHOOKS_FILE, {
    receivedAt: new Date().toISOString(),
    headers: req.headers,
    body: req.body || {}
  });
  res.status(200).json({ received:true });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  ensureStorage();
  console.log(`Rede Cats backend em http://localhost:${port}`);
});
