# 🆘 Resolução de Problemas / Troubleshooting

Guia de referência interna para erros comuns de desenvolvimento local e configuração de base de dados.

---

### `Error: DATABASE_URL is not defined`
O ficheiro `.env` não existe ou não tem a variável preenchida. Copie `.env.example` para `.env` e preencha a connection string. Reinicie o servidor com `npm run dev`.

### `Error: APP_ENCRYPTION_KEY is not defined` / `must be 32 bytes`
Gere a chave de 32 bytes em Base64 e adicione ao `.env`:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
⚠️ Mudar a chave numa base com dados reais torna os telefones ilegíveis.

### `Can't reach database server` / Timeout
- Verifique se a connection string do Neon inclui `?sslmode=require&uselibpqcompat=true`.
- No plano gratuito do Neon, a base de dados pode suspender por inatividade e demorar ~5 segundos a reativar no primeiro pedido.

### Reset de Palavra-Passe de Administrador
```powershell
npm run reset-password -- gestor@salaoexemplo.pt NovaPass123456
```

### `429 Demasiadas tentativas` (Rate Limiting)
O rate limiting está ativo em memória por segurança. Em desenvolvimento local, basta reiniciar o servidor `npm run dev` para limpar os contadores temporários.

### Migração de Base de Dados Falhou (`P3018` / Drift)
```powershell
npx prisma migrate status
npx prisma migrate deploy
```
Nunca execute `migrate reset` numa base de dados com dados reais.

### Porta 3000 Ocupada
```powershell
npm run dev -- -p 3001
```
