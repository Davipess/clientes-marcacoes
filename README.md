# Clientes-Marcações — Plataforma de Marcações Online

Plataforma de marcações online para salões de beleza (branca/white-label:
cada loja personaliza nome, logótipo, cores, textos, serviços e equipa).
Clientes marcam sem conta nem registo — apenas nome e telefone. Sem
pagamentos online: o pagamento é feito no local.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 ·
shadcn/ui · Prisma 7 · PostgreSQL (Neon) · Netlify

---

## 📋 Índice

1. [Funcionalidades](#-funcionalidades)
2. [Estrutura do projeto](#-estrutura-do-projeto)
3. [Requisitos](#-requisitos)
4. [Instalação local (passo a passo)](#-instalação-local-passo-a-passo)
5. [Primeiro arranque (criar a conta de administrador)](#-primeiro-arranque)
6. [Comandos disponíveis](#-comandos-disponíveis)
7. [Testes](#-testes)
8. [Deploy em produção (Netlify + Neon)](#-deploy-em-produção)
9. [Atualizar uma instância sem perder dados](#-atualizar-uma-instância)
10. [Resolução de problemas](#-resolução-de-problemas)
11. [Segurança](#-segurança)

---

## ✨ Funcionalidades

**Público (clientes)**
- Marcação em 5 passos: serviços → profissional → data/hora → dados → confirmação
- Múltiplos serviços numa visita (bloco contínuo, mesma técnica)
- Escolha de técnica específica ou "sem preferência"
- Disponibilidade em tempo real (horário do salão + horário de cada técnica + folgas + intervalos)
- Botão "primeira data disponível (30 dias)"
- Identificação apenas por **telefone** (encriptado na base de dados) — sem contas
- 100% responsivo, textos todos em português de Portugal

**Administração (dono do salão)**
- Dashboard: marcações do dia, próximos 7 dias, receita do mês, clientes
- Agenda diária com: criação manual (walk-in/telefone), reagendar, concluir,
  marcar falta, cancelar
- Serviços: CRUD com fotos (otimizadas no browser)
- Equipa: contas com login, horários semanais, serviços que cada uma realiza,
  folgas, ativar/desativar
- Clientes: histórico, notas internas, bloqueio manual, contador de faltas,
  anonimização (RGPD), exportar CSV
- Relatórios: receita por período (com comparação), serviços mais realizados,
  taxa de cancelamento e de faltas
- Definições: identidade visual (logo + cores), conteúdo do site (textos),
  horário de funcionamento, regras de marcação, prevenção de abusos

**Proteção contra abusos**
- Limite de marcações futuras e diárias por telefone
- Contador de faltas com aviso de "risco" — o bloqueio é sempre manual

---

## 📁 Estrutura do projeto

```
app/
  (public)/          → site público + fluxo de marcação
  (auth)/            → entrar + configuração inicial (primeiro admin)
  (admin)/           → painel de administração (protegido por sessão)
  (staff)/           → área da técnica (agenda própria + bloqueios)
  api/               → endpoints (auth, marcações, disponibilidade, admin/*, staff/*)
components/          → UI (ui/ = shadcn, admin/, staff/, booking/, site/)
lib/                 → motor de marcações, auth, crypto, validação, etc.
prisma/              → schema.prisma, migrações, seed
docs/                → DEPLOY.md e UPGRADE.md
scripts/             → testes e utilitários (reset-password, retention, etc.)
```

---

## 🧰 Requisitos

- **Node.js 20.9+** (recomendado 22 LTS) — `node --version`
- **npm 10+** — `npm --version`
- Uma base de dados **PostgreSQL** — [Neon](https://neon.tech) (gratuito) recomendado
- Git

---

## 🚀 Instalação local (passo a passo)

```powershell
# 1. Instalar dependências exatas do lockfile
npm ci

# 2. Criar o ficheiro de ambiente a partir do exemplo
Copy-Item .env.example .env
```

3. Edita `.env` e preenche:

| Variável | Onde obter |
|---|---|
| `DATABASE_URL` | Neon → projeto → Connection string (com `?sslmode=require`) |
| `APP_ENCRYPTION_KEY` | Gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (em dev) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | (opcional) conta admin criada pela seed |

```powershell
# 4. Criar as tabelas (aplica todas as migrações por ordem)
npx prisma migrate deploy

# 5. Criar o negócio + dados de demonstração
npx tsx prisma/seed.ts

# 6. Arrancar
npm run dev
```

Abre http://localhost:3000 — painel em `/admin`, login em `/entrar`.

> **Nota:** se a seed não criou o admin (variáveis não estavam no `.env`),
> usa a página `/configuracao-inicial` — só funciona enquanto não existir
> nenhum administrador.

---

## 🏁 Primeiro arranque

1. Entra em `/entrar` com o email/password da seed (ou criados em
   `/configuracao-inicial`)
2. **Definições → O meu perfil**: muda o teu nome, email e o nome público
   como técnica (por defeito é "Gestora")
3. **Definições → Identidade visual**: logo e cores
4. **Definições → Conteúdo do site**: textos da página inicial
5. **Serviços**: cria as tuas categorias e serviços
6. **Equipa**: cria contas para as técnicas (ou ativa o "modo individual"
   se fores tu a única)
7. **Definições → Horário**: horário de funcionamento real

---

## 🛠️ Comandos disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (http://localhost:3000) |
| `npm run build` | Build de produção |
| `npm run start` | Servir o build de produção |
| `npm run lint` | Verificação de código (ESLint) |
| `npm run format` | Formatar código (Prettier) |
| `npm run db:generate` | Regenerar o cliente Prisma (após mudar o schema) |
| `npm run db:migrate` | Nova migração em desenvolvimento |
| `npm run db:deploy` | Aplicar migrações pendentes (produção) |
| `npm run db:seed` | Criar negócio/admin/demo (idempotente) |
| `npm run db:studio` | Prisma Studio (ver a base de dados no browser) |
| `npm run retention` | Apagar marcações antigas em estado final (retenção RGPD) |
| `npm run test` | Suíte de testes do motor + Fase 14 |
| `npm run reset-password -- <email> <nova>` | Reset de palavra-passe (termina sessões) |

---

## 🧪 Testes

```powershell
npm run test              # motor de disponibilidade + Fase 14 (30 verificações)
$env:NODE_OPTIONS="--conditions=react-server"
npx tsx scripts/test-security-full.ts   # segurança (33 verificações, requer dev server a correr)
npx tsx scripts/test-agenda.ts          # fluxo completo via API (requer dev server)
```

Os testes escrevem e apagam dados de teste na base de dados configurada —
**não correr contra produção**.

---

## 🌍 Deploy em produção

Guia completo em **[docs/DEPLOY.md](docs/DEPLOY.md)**. Resumo:
GitHub → Netlify (import) → variáveis de ambiente → `npx prisma migrate deploy`.

## ⬆️ Atualizar sem perder dados

Guia completo em **[docs/UPGRADE.md](docs/UPGRADE.md)**. Resumo:
`git pull` → `npm ci` → `npx prisma migrate deploy` → build. Migrações são
aditivas; dados vivem sempre na base de dados.

---

## 🆘 Resolução de problemas

### `Error: DATABASE_URL is not defined`
O ficheiro `.env` não existe ou não tem a variável. Copia `.env.example`
para `.env` e preenche. Reinicia o `npm run dev` depois de editar `.env`.

### `Error: APP_ENCRYPTION_KEY is not defined` / `must be 32 bytes`
Gera a chave e adiciona ao `.env`:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
⚠️ Mudar a chave numa base com dados torna os telefones ilegíveis — só
mudar em base vazia.

### `Can't reach database server` / timeout
- Connection string correta? (Neon: copia da consola, com `sslmode=require`)
- A base Neon está "Active"? (free tier suspende após inatividade — um
  request reativa, espera ~5s)

### Aviso SSL do pg (`SSL modes... aliases for verify-full`)
Já resolvido com `uselibpqcompat=true` na connection string. Se aparecer,
confirma que o `.env` tem `?sslmode=require&uselibpqcompat=true`.

### Não consigo entrar / esqueci a palavra-passe
```powershell
npm run reset-password -- gestor@salaoexemplo.pt NovaPass123456
```
(termina todas as sessões ativas dessa conta)

### `429 Demasiadas tentativas`
Rate limiting ativo (por design). Em dev, reinicia o servidor `npm run dev`
( limpa os contadores, que ficam em memória).

### A agenda/disponibilidade aparece vazia
Verifica por ordem:
1. Existe **técnica ativa**? (Equipa — se estiver "inativa", reativa)
2. A técnica tem **horário semanal**? (Equipa → abre a técnica)
3. Os **serviços** estão associados à técnica? (Equipa → serviços)
4. O **horário do salão** (Definições) tem o dia aberto?
5. Criaste um serviço novo recentemente? É associado automaticamente às
   técnicas ativas — se criaste com as técnicas desativadas, edita e
   guarda, ou associa em Equipa.

### `Error: You cannot have two parallel pages that resolve to the same path`
Dois `page.tsx` em route groups diferentes resolvem o mesmo URL. Cada
grupo só pode ter um `page.tsx` na raiz do grupo.

### Migração falhou (`P3018` / drift)
```powershell
npx prisma migrate status        # ver o estado
npx prisma migrate deploy        # reaplicar pendentes
```
Se uma migração falhou a meio: corrige a causa e usa
`npx prisma migrate resolve --applied <nome>` apenas se o SQL já foi
aplicado manualmente. **Nunca** `migrate reset` com dados reais.

### `server-only` error ao correr scripts
Os scripts que acedem à BD precisam de:
```powershell
$env:NODE_OPTIONS="--conditions=react-server"; npx tsx <script>
```
(os comandos `npm run test` e `npm run reset-password` já incluem isto)

### Porta 3000 ocupada
`npm run dev -- -p 3001` ou fecha o outro processo node.

### Erros de TypeScript ao compilar
Confirma Node 20.9+ e corre `npm ci` (o lockfile fixa as versões exatas).

---

## 🔐 Segurança (resumo)

- Passwords com **argon2id**; sessões com tokens aleatórios guardados como
  SHA-256; cookies `HttpOnly` + `SameSite=Lax` + `__Host-` (produção)
- Telefones encriptados **AES-256-GCM** em repouso (chave só no servidor)
- Rate limiting em login, marcações, disponibilidade, uploads e exports
- Validação Zod em todos os inputs; isolamento por negócio em todas as
  queries; CSRF por verificação de origem
- Headers de segurança (CSP/HSTS em produção), `noindex` nos painéis
- Auditoria das ações sensíveis da administração
- Suíte de segurança automatizada: 33 verificações (`scripts/test-security-full.ts`)

## 📄 Licença

Todos os direitos reservados. Uso interno/comercial mediante acordo.
