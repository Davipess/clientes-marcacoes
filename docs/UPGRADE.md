# Guia de Atualização (para instâncias vendidas/hospedadas)

Objetivo: atualizar a aplicação **sem perder nenhum dado** de clientes,
marcações ou configurações. Os dados vivem na base de dados (Neon) — o
código é substituível a qualquer momento.

## Regra de ouro

Os dados **nunca** vivem no código. Tudo o que a gerência introduz
(serviços, fotos, horários, clientes, definições, branding) está na base
de dados. Atualizar o código = substituir apenas o código.

## Procedimento de atualização

```bash
# 1. Backup de segurança (Neon → console → Backups, ou):
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql

# 2. Obter a nova versão
git pull origin main

# 3. Dependências exatas do lockfile
npm ci

# 4. Aplicar migrações da base de dados (aditivas, sem perda)
npx prisma migrate deploy

# 5. Build e deploy
npm run build
# (no Netlify: o push para o GitHub faz deploy automaticamente;
#  corra o passo 4 ANTES do push quando houver migrações novas)
```

## Política de migrações (o que garante compatibilidade)

- Migrações são **aditivas**: colunas novas nulas, índices novos, nada de
  drops de colunas com dados. Versões antigas de código continuam a
  funcionar sobre a base atualizada (backward-compatible por design).
- `prisma migrate deploy` aplica apenas as pendentes, por ordem, uma vez
  cada — seguro repetir, seguro em produção.
- **Nunca** correr `migrate reset` nem `db push` numa instância com dados.
- O contador de faltas (Fase 14) vive na tabela `clients` e sobrevive à
  limpeza de histórico (`npm run retention`).

## Compatibilidade de versões

- `VERSION` na raiz indica a versão da instância.
- Entre versões minor/patch: basta o procedimento acima.
- Para uma versão maior (ex.: 1.x → 2.x), ler `docs/UPGRADE.md` dessa
  versão primeiro — pode ter passos extra (variáveis de ambiente novas,
  etc.). Variáveis novas aparecem sempre documentadas em `.env.example`.

## Rollback

```bash
git checkout <tag-anterior>
npm ci
npm run build
# A base de dados não precisa de rollback: migrações antigas funcionam
# sobre o schema atualizado (colunas novas são opcionais no código antigo).
```

Se um rollback exigir reverter uma migração (raro), restaurar o backup
do passo 1 — nunca editar migrações já aplicadas.

## Checklist pós-atualização

- [ ] Login funciona
- [ ] Uma marcação de teste cria e aparece na agenda
- [ ] Site público mostra serviços e horários corretos
- [ ] `npx prisma migrate status` → "Database schema is up to date!"
