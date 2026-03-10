import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, 'storage');
const STORAGE_FILE = path.join(STORAGE_DIR, 'orders.json');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '1mb' }));

function ensureStorage(){
  if(!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if(!fs.existsSync(STORAGE_FILE)) fs.writeFileSync(STORAGE_FILE, '[]');
}

function readOrders(){
  ensureStorage();
  return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
}

function writeOrders(orders){
  ensureStorage();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(orders, null, 2));
}

function brId(){
  return `RC-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
}

function generateMockPixCode(orderId, amount){
  return `00020126580014BR.GOV.BCB.PIX0136checkout@redecats.ex520400005303986540${String(amount).replace(/\D/g,'')}5802BR5920REDE CATS6008GOIANIA62070503***6304${String(orderId).slice(-4)}`;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'redecats-store-backend', time: new Date().toISOString() });
});

app.post('/api/orders', async (req, res) => {
  const body = req.body || {};
  const cart = Array.isArray(body.cart) ? body.cart : [];
  const totals = body.totals || {};
  const customer = body.customer || {};

  if(!cart.length) return res.status(400).json({ error: 'Carrinho vazio.' });
  if(!customer.playerNick || !customer.email || !customer.fullName) {
    return res.status(400).json({ error: 'Dados do comprador incompletos.' });
  }

  const orderId = brId();
  const order = {
    orderId,
    status: 'pending',
    mode: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'gateway' : 'demo',
    createdAt: new Date().toISOString(),
    paymentMethod: body.paymentMethod || 'pix',
    customer,
    items: cart,
    coupon: body.coupon || null,
    totals: {
      subtotal: Number(totals.subtotal || 0),
      discount: Number(totals.discount || 0),
      total: Number(totals.total || 0)
    },
    payment: {
      expiresInMinutes: 30,
      qrCodeText: generateMockPixCode(orderId, Number(totals.total || 0).toFixed(2)),
      qrCodeBase64: '',
      externalUrl: body.paymentMethod === 'mercadopago' ? 'https://www.mercadopago.com.br/' : '',
      instructions: process.env.MERCADOPAGO_ACCESS_TOKEN
        ? 'Conecte a criação real do pagamento neste ponto com o Mercado Pago /v1/payments para Pix e use o webhook para confirmar.'
        : 'Backend em modo demo. Configure MERCADOPAGO_ACCESS_TOKEN para avançar.'
    }
  };

  const orders = readOrders();
  orders.push(order);
  writeOrders(orders);
  res.status(201).json(order);
});

app.get('/api/orders/:orderId', (req, res) => {
  const order = readOrders().find(item => item.orderId === req.params.orderId);
  if(!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  res.json(order);
});

app.post('/api/webhooks/mercadopago', (req, res) => {
  const payload = req.body || {};
  const orders = readOrders();
  const entry = {
    id: `WH-${Date.now()}`,
    receivedAt: new Date().toISOString(),
    payload
  };
  fs.writeFileSync(path.join(STORAGE_DIR, 'webhooks-last.json'), JSON.stringify(entry, null, 2));
  // Próxima etapa: validar assinatura x-signature e buscar o pagamento na API do Mercado Pago.
  res.status(200).json({ received: true });
});

app.post('/api/orders/:orderId/simulate-approve', (req, res) => {
  const orders = readOrders();
  const order = orders.find(item => item.orderId === req.params.orderId);
  if(!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  order.status = 'approved';
  order.approvedAt = new Date().toISOString();
  writeOrders(orders);
  res.json(order);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  ensureStorage();
  console.log(`Rede Cats backend rodando em http://localhost:${port}`);
});
