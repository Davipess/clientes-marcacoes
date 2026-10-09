# 🔄 Instance Upgrade & Zero-Downtime Migration Guide

## 🎯 Objective
This guide outlines the procedure for upgrading deployed instances of the booking platform **without data loss or downtime**. All application data (clients, appointments, staff, settings) lives securely inside the PostgreSQL database (Neon); the application code and serverless functions can be upgraded or replaced at any time.

---

## 🔒 Core Engineering Principles

1. **State Isolation:** No persistent state lives within ephemeral serverless containers. All mutations are strictly committed to PostgreSQL.
2. **Additive-Only Migrations:** Prisma schema migrations are designed to be strictly backward-compatible and additive (adding optional columns, new tables, or non-blocking indexes). Older running containers continue to operate seamlessly while new migrations are deployed.
3. **Never Reset Production:** Never run `prisma migrate reset` or `prisma db push` on a production instance.

---

## 🛠️ Upgrade Procedure

```bash
# 1. Create a safety backup (Neon Console -> Backups, or via pg_dump):
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql

# 2. Fetch the latest codebase updates:
git pull origin main

# 3. Install locked dependencies:
npm ci

# 4. Apply non-destructive database migrations:
npx prisma migrate deploy

# 5. Build and verify deployment:
npm run build
```

---

<details>
<summary><b>🇵🇹 Guia de Atualização em Português</b></summary>

### Procedimento de Atualização (Sem Perda de Dados)

O objetivo é atualizar a aplicação garantindo integridade absoluta de dados de clientes, marcações e configurações.

* **Regra Fundamental:** Os dados nunca vivem no código. Atualizar o código significa apenas substituir a camada de aplicação.
* **Política de Migrações:** As migrações são estritamente aditivas e retrocompatíveis.
* **Comandos:**
  ```bash
  git pull origin main
  npm ci
  npx prisma migrate deploy
  npm run build
  ```
</details>
