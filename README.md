# SalãoApp

Online booking and salon management web application with an ephemeral privacy lifecycle for client data.

## Status

Project built for a prospective client, currently not in production.

## What It Does

- Public booking flow where clients select services, staff, and real-time open slots without creating an account.
- Privacy lifecycle: client phone numbers are stored as a one-way SHA-256 hash for abuse tracking and an AES-256-GCM encrypted field for active reminders; personal details are erased once the appointment finishes.
- Abuse prevention: limits each client to a maximum of 3 active appointments per phone number hash.
- Salon owner dashboard with daily agenda, appointment status management (confirmed, completed, cancelled, no-show), service catalog, and staff schedules.
- Milestone loyalty points and voucher redemption configurable by the salon owner.

## How I Built It

I directed AI-assisted development to build this application. I designed the product concept, defined the relational schema, and established the privacy model so clients would not need accounts. I guided AI tools to generate boilerplate for Next.js routes, UI components, and Prisma models. My main technical work was defining business rules, auditing backend API boundaries to prevent unauthorized mutations, and implementing the post-appointment data erasure logic.

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- PostgreSQL (Neon Serverless)
- Prisma ORM
- Tailwind CSS
- Web Push API (web-push)
- Argon2id (@node-rs/argon2) for admin authentication

## How to Run

1. Clone repository and install dependencies:
```bash
git clone https://github.com/Davipess/clientes-marcacoes.git
cd clientes-marcacoes
npm ci
```

2. Set environment variables:
```bash
cp .env.example .env
# Edit .env with your PostgreSQL DATABASE_URL and generate an encryption key
```

3. Initialize database and seed demo data:
```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

4. Start development server:
```bash
npm run dev
```

Open `http://localhost:3000` for the booking interface and `http://localhost:3000/admin` for the management dashboard.

## Tests

No automated test suite is currently configured. Functionality, slot calculations, and API access controls were tested manually through the browser and direct API requests during development.

## Known Limitations and Next Steps

- Single-tenant deployment: configured for a single salon business instance.
- No live cellular SMS gateway: uses browser Web Push notifications rather than SMS text messages.
- Next steps include adding automated API integration tests and automated database backup verification.

## License

All rights reserved. Proprietary software developed for commercial client evaluation.
