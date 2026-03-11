# Backend da loja Rede Cats

Esta etapa liga o checkout próprio ao **Pix real do Mercado Pago** e já deixa a base da **entrega automática** pronta.

## O que já faz
- cria pedidos próprios em `POST /api/orders`
- gera **Pix real** via Mercado Pago quando `MERCADOPAGO_ACCESS_TOKEN` está configurado
- consulta pedido em `GET /api/orders/:orderId`
- atualiza status em `POST /api/orders/:orderId/refresh-payment`
- recebe webhook em `POST /api/webhooks/mercadopago`
- cria fila de entrega automática quando o pedido fica **approved**
- salva pedidos em `storage/orders.json`
- salva jobs de entrega em `storage/deliveries.json`
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
- `PUBLIC_BACKEND_URL`: URL pública do backend
- `MERCADOPAGO_ACCESS_TOKEN`: Access Token do Mercado Pago
- `DELIVERY_BRIDGE_TOKEN`: token secreto usado pela bridge do servidor para buscar e confirmar entregas

## Catálogo de entrega
Edite `delivery-catalog.json` com os comandos reais do seu servidor.

Exemplo:
```json
{
  "products": {
    "vip-elite-mensal": {
      "commandTemplates": [
        "lp user {player} parent settemp elite 30d"
      ]
    },
    "cash5000": {
      "commandTemplates": [
        "cash add {player} 5000"
      ]
    }
  }
}
```

Placeholders suportados:
- `{player}`
- `{orderId}`
- `{qty}`
- `{productName}`
- `{price}`
- `{total}`
- `{cash}`

## Fluxo esperado
1. O checkout envia o pedido para `POST /api/orders`
2. O backend cria o pedido da Rede Cats
3. O backend cria o Pix do Mercado Pago
4. Quando o Pix é aprovado, o webhook sincroniza o pedido
5. O backend cria os **jobs de entrega**
6. A bridge do servidor consome o próximo job pendente
7. Depois de executar o comando no Minecraft, a bridge marca o job como entregue

## Rotas principais
### `GET /api/health`
Retorna status do backend e se o Mercado Pago / bridge foram configurados.

### `GET /api/orders/:orderId`
Consulta o pedido, incluindo o resumo da entrega.

### `GET /api/orders/:orderId/delivery`
Mostra os jobs de entrega daquele pedido.

### `POST /api/orders/:orderId/create-delivery`
Cria novamente a fila de entrega de um pedido aprovado.

### `POST /api/delivery/bridge/claim-next`
Bridge do servidor pega o próximo job pendente.

### `POST /api/delivery/bridge/:jobId/complete`
Bridge confirma entrega realizada.

### `POST /api/delivery/bridge/:jobId/fail`
Bridge informa falha e guarda o erro.

## Observação importante
Os comandos padrão do catálogo são apenas uma base. Revise os nomes de grupo e o comando real de cash antes de usar em produção.
