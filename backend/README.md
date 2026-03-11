# Rede Cats backend

Etapa 3A: pedido próprio + página de pagamento própria.

## O que já faz
- cria pedido em `POST /api/orders`
- consulta pedido em `GET /api/orders/:orderId`
- simula aprovação em `POST /api/orders/:orderId/simulate-approve`
- recebe placeholder de webhook em `POST /api/webhooks/mercadopago`

## Rodar localmente
```bash
cd backend
npm install
npm run dev
```

## Variáveis
Copie `.env.example` para `.env`.

## Frontend
Quando o backend estiver publicado, passe a base da API na URL:

```text
https://seusite.github.io/Rede-Cats/checkout.html?api=https://seu-backend.onrender.com
```

ou salve manualmente em `localStorage.redecats_api_base`.

## Próxima etapa
- integrar Pix real do Mercado Pago
- validar webhook
- confirmar pagamento automaticamente
