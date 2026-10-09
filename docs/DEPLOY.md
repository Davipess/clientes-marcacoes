# 🚀 Production Deployment Guide: Netlify & Neon PostgreSQL

## 📋 Prerequisites
* **Netlify Account:** Free tier supports commercial usage and Next.js App Router serverless runtime.
* **Neon PostgreSQL Account:** Serverless PostgreSQL with connection pooling.
* **Git Repository:** Connected to your GitHub remote.

---

## 🛠️ Step-by-Step Deployment

### 1. Database Provisioning (Neon)
1. Create a Neon project with pooling enabled.
2. The platform operates on a **Least-Privilege Database Principle** with two users:
   * **`app_user` (Runtime):** Granted only standard CRUD permissions (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). It possesses **zero DDL privileges**, ensuring that even in the unlikely event of an application exploit, the schema cannot be dropped or altered.
   * **`neondb_owner` (Migrations):** Used strictly by Prisma CLI during schema deployments.
3. Generate the runtime user URL:
   ```bash
   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/setup-db-user.ts
   ```

### 2. Environment Variables Configuration (Netlify)
Navigate to **Site settings → Environment variables** in your Netlify dashboard and define:

| Variable | Description | Source |
|---|---|---|
| `DATABASE_URL` | Runtime pooled connection string | Neon `app_user` URL (with `?sslmode=require`) |
| `MIGRATE_DATABASE_URL` | DDL connection string for migrations | Neon owner connection string |
| `APP_ENCRYPTION_KEY` | 32-byte Base64 AES-256-GCM encryption key | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_APP_URL` | Canonical production URL | `https://your-domain.netlify.app` |
| `VAPID_PUBLIC_KEY` | Web push public key | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Web push private key | Generated with command above |
| `CRON_SECRET` | Secret token for retention & reminder endpoints | Cryptographically random string |

> ⚠️ **Security Rule:** Never commit the `.env` file containing actual keys or production connection strings.

### 3. Production Migration & Seed
Apply additive migrations without data loss:
```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

### 4. Post-Deployment Verification Checklist
- [ ] Homepage loads and reflects salon branding, services, and working hours.
- [ ] Completed an end-to-end booking flow at `/marcar`.
- [ ] Administrative login verified at `/entrar`.
- [ ] Automated push notification dispatched upon booking completion.
- [ ] Cleaned up the test booking in the admin schedule dashboard.

---

<details>
<summary><b>🇵🇹 Guia de Deploy em Português</b></summary>

### Deploy: Netlify + Neon

#### Pré-requisitos
* Conta Netlify (plano gratuito permite uso comercial)
* Base de dados Neon já criada com connection pooling

#### Passos Principais
1. **Repositório:** Fazer push do código para o GitHub.
2. **Netlify:** "Add new site" → "Import an existing project" → selecionar o repositório. O ficheiro `netlify.toml` já está configurado.
3. **Variáveis de ambiente:** Configurar `DATABASE_URL` (utilizador com menores privilégios `app_user`), `APP_ENCRYPTION_KEY` (chave AES de 32 bytes) e chaves VAPID.
4. **Migrações:** Executar `npx prisma migrate deploy` e `npx tsx prisma/seed.ts`.
5. **Verificação:** Testar o fluxo completo de agendamento e o painel de administração em `/admin`.
</details>