# Deploy — Netlify + Neon

## Pré-requisitos (contas gratuitas)
- Conta Netlify (plano free — permite uso comercial)
- Base de dados Neon já criada (a de desenvolvimento serve para começar;
  para produção crie um projeto/branch separado no Neon — também gratuito)

## Passos

1. **Repositório**: faça push do repo para o GitHub
   (`git remote add origin ... && git push -u origin main`).

2. **Netlify**: "Add new site" → "Import an existing project" → escolha o
   repo. O `netlify.toml` já está configurado (build + plugin Next.js).

3. **Variáveis de ambiente** (Netlify → Site settings → Environment variables):

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | connection string do utilizador **app_user** (privilégios CRUD, sem DDL — ver "Dois utilizadores" abaixo) |
| `MIGRATE_DATABASE_URL` | connection string do **dono** da BD (neondb_owner) — usada apenas pelo CLI de migrações |
   | `APP_ENCRYPTION_KEY` | chave base64 de 32 bytes (gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) |
   | `NEXT_PUBLIC_APP_URL` | URL final do site (ex.: `https://salaoexemplo.netlify.app`) |
   | `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | (opcional) para a seed criar o admin |
   | `STAFF_*` | (opcional) para a seed criar staff |

   ⚠️ Nunca comitar o `.env` real. A `APP_ENCRYPTION_KEY` de produção deve
   ser **diferente** da de desenvolvimento? Não — se for diferente, os dados
   encriptados pela chave antiga ficam ilegíveis. Use a mesma chave se quiser
   manter os dados, ou comece a base de produção vazia com chave nova.

4. **Base de dados de produção**:
   ```bash
   # apontar DATABASE_URL para o Neon de produção e correr:
   npx prisma migrate deploy
   npx tsx prisma/seed.ts   # cria o negócio + admin (idempotente)
   ```
   Estratégia: `migrate deploy` aplica apenas migrações pendentes, por ordem,
   sem perda de dados. Nunca usar `migrate reset` / `db push` em produção.
   Antes de cada release com migrações novas, correr `migrate deploy` primeiro
   (as migrações são aditivas e retro-compatíveis por design).

5. **Domínio**: Netlify → Domain management → adicionar domínio próprio
   (grátis, só paga o domínio se quiser um .pt — o .netlify.app é gratuito).

## Verificação pós-deploy
- [ ] Homepage carrega e mostra o nome/horário do salão
- [ ] `/marcar` completa uma marcação de teste (verificar no admin)
- [ ] Login em `/entrar` funciona
- [ ] `/sitemap.xml` e `/robots.txt` acessíveis
- [ ] Marcação de teste apagada no painel admin

## Limitações conhecidas (100% gratuito)
- Notificações automáticas ao cliente (confirmação/lembrete): infraestrutura
  pronta (`lib/notifications.ts`) mas sem canal de entrega ativo — SMS custa
  dinheiro; quando houver orçamento, ligar WhatsApp Business Cloud API.
- Recuperação de palavra-passe: o link é registado no log do servidor
  (dev). Em produção, configurar Resend (free tier: 100 emails/dia) e ligar
  em `app/api/auth/forgot-password/route.ts` — apenas para staff/admin.

## Segurança em produção (notas)

- **Rate limiting em memória**: funciona numa única instância; se escalar
  horizontalmente, migrar para Upstash Redis (free tier) — ver lib/rate-limit.ts.
- **MFA para admin**: campo 	woFactorSecretEnc já reservado no schema; TOTP é o
  próximo passo no roadmap de segurança.
- **Backups**: ativar backups automáticos no Neon (plano free inclui histórico
  de 24h; point-in-time restore disponível). Exportar pg_dump semanal para
  redundância externa.
- **Dependências**: correr 
pm audit antes de cada atualização; manter
  Next.js na versão mais recente (patch de CVE críticos históricos).

## Dois utilizadores de base de dados (menor privilégio)

A aplicação corre com pp_user (SELECT/INSERT/UPDATE/DELETE — sem DDL: mesmo
comprometida, não consegue apagar nem alterar tabelas). As migrações correm com
o utilizador owner via MIGRATE_DATABASE_URL.

Criar o pp_user numa instância nova:

`powershell
$env:NODE_OPTIONS="--conditions=react-server"
npx tsx scripts/setup-db-user.ts   # escreve a URL em db-user-url.txt
`"

Copiar a URL gerada para DATABASE_URL (Netlify + .env local).

## Dois utilizadores de base de dados (menor privilégio)

A aplicação corre com `app_user` (SELECT/INSERT/UPDATE/DELETE — **sem DDL**:
mesmo comprometida, não consegue apagar nem alterar tabelas). As migrações
correm com o utilizador owner via `MIGRATE_DATABASE_URL`.

Criar o `app_user` numa instância nova:

```powershell
$env:NODE_OPTIONS="--conditions=react-server"
npx tsx scripts/setup-db-user.ts   # escreve a URL em db-user-url.txt
```

Copiar a URL gerada para `DATABASE_URL` (Netlify + `.env` local).