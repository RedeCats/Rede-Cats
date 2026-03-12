# Backend da loja Rede Cats

Esta etapa liga o checkout próprio ao **Pix real do Mercado Pago**.

## O que já faz
- cria pedidos próprios em `POST /api/orders`
- gera **Pix real** via Mercado Pago quando `MERCADOPAGO_ACCESS_TOKEN` está configurado
- consulta pedido em `GET /api/orders/:orderId`
- atualiza status em `POST /api/orders/:orderId/refresh-payment`
- recebe webhook em `POST /api/webhooks/mercadopago`
- salva pedidos em `storage/orders.json`
- salva os últimos webhooks em `storage/webhooks-last.json`

## Como rodar localmente
```bash
cd backend
npm install
npm run dev
```

## Variáveis de ambiente
Copie `.env.example` para `.env` e preencha:

- `FRONTEND_ORIGIN`: domínio do seu site
- `PUBLIC_BACKEND_URL`: URL pública do backend (necessária para webhook)
- `MERCADOPAGO_ACCESS_TOKEN`: Access Token do Mercado Pago

## Fluxo esperado
1. O checkout envia o pedido para `POST /api/orders`
2. O backend cria o pedido da Rede Cats
3. Se houver token do Mercado Pago, o backend cria um **pagamento Pix real**
4. O frontend abre `payment.html?order_id=...`
5. A página mostra QR Code/código Pix
6. O backend recebe o webhook do Mercado Pago e atualiza o pedido
7. A página pode atualizar o status usando `refresh-payment`

## Rotas
### `GET /api/health`
Retorna status do backend e se o Mercado Pago foi configurado.

### `POST /api/orders`
Body esperado:
```json
{
  "customer": {
    "playerNick": "LDL_Silas_",
    "firstName": "Silas",
    "lastName": "Teste",
    "fullName": "Silas Teste",
    "email": "email@exemplo.com",
    "cpf": "00000000000"
  },
  "cart": [],
  "coupon": null,
  "paymentMethod": "pix",
  "totals": {
    "subtotal": 100,
    "discount": 0,
    "total": 100
  }
}
```

### `GET /api/orders/:orderId?refresh=1`
Consulta o pedido. Com `refresh=1`, tenta sincronizar o pagamento no Mercado Pago.

### `POST /api/orders/:orderId/refresh-payment`
Força nova consulta no Mercado Pago usando o `paymentId` salvo.

### `POST /api/webhooks/mercadopago`
URL para cadastrar nos Webhooks do Mercado Pago.

## Observações
- O Mercado Pago exige `X-Idempotency-Key` na criação de pagamentos. Esta integração já envia esse header. citeturn642437search6turn642437search12
- O Pix pode ser criado pela API de pagamentos (`POST /v1/payments`) com `payment_method_id = pix`. citeturn898719search0turn898719search11
- O Mercado Pago envia notificações por webhook e inclui assinatura secreta para validar origem. citeturn221401search0turn642437search1turn642437search11

Nesta etapa, a validação criptográfica da assinatura secreta ficou separada para a próxima revisão fina. O webhook já recebe, registra e sincroniza o pagamento pelo `paymentId`.


## Entrega automática por RCON

Quando o pedido é aprovado, o backend cria os jobs de entrega e tenta executar automaticamente os comandos no console do servidor via RCON.

Variáveis novas:
- `RCON_HOST`
- `RCON_PORT`
- `RCON_PASSWORD`
- `RCON_TIMEOUT_MS`

Para a BedHosting do seu caso:
- host: `ultra-04.bedhosting.com.br`
- porta RCON: `37050`
- porta do servidor: `37444`

Use os comandos sem `/`, porque o backend envia direto para o console.

### Teste rápido
1. Configure o `.env`.
2. Rode `npm install` e `npm start` na pasta `backend`.
3. Crie um pedido em modo teste.
4. Aprove o pedido ou aguarde o webhook do Mercado Pago.
5. O backend tentará entregar automaticamente via RCON.

### Rotas úteis
- `GET /api/health`
- `POST /api/orders/:orderId/process-delivery`
- `POST /api/delivery/process-pending`

Se o RCON não estiver configurado, os jobs continuam na fila e você pode processá-los depois.
