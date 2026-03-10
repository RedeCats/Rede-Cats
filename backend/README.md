# Backend da loja - Rede Cats

Esta etapa prepara um backend separado para o checkout.

## O que ele faz nesta versão
- cria pedidos em `/api/orders`
- salva um JSON simples em `storage/orders.json`
- retorna payload pronto para a tela `payment.html`
- deixa webhook Mercado Pago separado em `/api/webhooks/mercadopago`

## Instalação
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Configuração do frontend
Edite `../assets/api-config.js` e preencha `apiBaseUrl` com a URL do backend.

Exemplo:
```js
window.RedeCatsApiConfig = {
  apiBaseUrl: 'http://localhost:3000',
  storeName: 'Rede Cats',
  supportUrl: 'https://discord.gg/GQZGduc9'
};
```

## Observações importantes
- O fluxo já está preparado para Pix/checkout externo.
- Ainda faltam as credenciais reais do gateway e a lógica de entrega no servidor.
- Em produção, os preços devem ser recalculados no backend a partir de um catálogo próprio.
