# Technical Assessment

Two independent projects:

| Folder | What | Stack |
| --- | --- | --- |
| [`frontend/`](frontend/) | Cars list with responsive images, add-car form, search / sort / year filters, unit tests | React 19, TypeScript, Vite, Apollo Client, Material UI, MSW, Vitest |
| [`backend/`](backend/) | NHTSA XML ingestion → unified JSON → PostgreSQL → GraphQL API, with Docker and CI | Node 20, TypeScript, Express 5, Apollo Server 4, Prisma, Zod, Pino, Vitest |

Each folder has its own README with setup, scripts, architecture notes and test instructions.

Quick start:

```bash
# frontend
cd frontend && npm install && npm run dev        # http://localhost:5173

# backend (needs Docker)
cd backend && docker compose up --build          # http://localhost:3000/graphql
```
