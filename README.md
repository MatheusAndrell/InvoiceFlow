# InvoiceFlow

A production-ready, full-stack **asynchronous NFS-e (Nota Fiscal de Serviço Eletrônica) issuer simulator** with mock government integration, built with Node.js, TypeScript, React, and Docker.

---

## 📐 Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend  │────▶│  API (3000)  │────▶│ PostgreSQL (DB) │
│  React/Vite │     │ Express+JWT  │     └─────────────────┘
│   (8080)    │     └──────┬───────┘               ▲
└─────────────┘            │ BullMQ                │
                           ▼                       │
                    ┌──────────────┐               │
                    │    Redis     │               │
                    └──────┬───────┘               │
                           │                       │
                           ▼                       │
                    ┌──────────────┐               │
                    │   Worker     │───────────────┘
                    │  (BullMQ)   │
                    └──────┬───────┘
                           │ HTTP POST
                           ▼
                    ┌──────────────────┐
                    │ Prefeitura Mock  │
                    │    (3001)        │
                    └──────────────────┘
```

### Services

| Service | Technology | Port | Description |
|---------|-----------|------|-------------|
| `frontend` | React + Vite + Nginx | 8080 | User interface |
| `api` | Node.js + Express + TypeScript | 3000 | REST API, JWT auth |
| `worker` | Node.js + BullMQ + TypeScript | — | Async job processor |
| `prefeitura-mock` | Node.js + Express | 3001 | Simulated government API |
| `db` | PostgreSQL 16 | 5432 | Primary database |
| `redis` | Redis 7 | 6379 | Message queue broker |

### Key Architectural Decisions

1. **Asynchronous Processing**: `POST /sales` returns `202 Accepted` immediately and enqueues a BullMQ job. The worker processes it independently.
2. **Idempotency**: Before processing, the worker checks the sale status — already-processed sales are skipped.
3. **Retry with Exponential Backoff**: Failed prefeitura calls are retried up to 3 times with exponential delays (2s, 4s). BullMQ also retries the full job up to 3 times.
4. **Certificate Security**: PFX files are stored locally; passwords are encrypted with AES-256-CBC before database storage.
5. **Service Layer Pattern**: Business logic lives in `services/`, not controllers.

---

## 🚀 Quick Start

### Prerequisites

- Docker ≥ 24
- Docker Compose ≥ 2.20

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/MatheusAndrell/InvoiceFlow.git
   cd InvoiceFlow
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env and set strong values for JWT_SECRET and ENCRYPTION_SECRET
   ```

3. **Start all services**
   ```bash
   docker compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:8080
   - API: http://localhost:3000
   - Prefeitura Mock: http://localhost:3001

5. **Default credentials**
   - Email: `admin@demo.com`
   - Password: `admin`

---

## 🔐 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | No | `invoiceflow` | PostgreSQL username |
| `POSTGRES_PASSWORD` | **Yes** | — | PostgreSQL password |
| `POSTGRES_DB` | No | `invoiceflow` | PostgreSQL database name |
| `JWT_SECRET` | **Yes** | — | JWT signing secret (min 32 chars) |
| `ENCRYPTION_SECRET` | **Yes** | — | AES-256 key for certificate passwords (min 32 chars) |
| `PREFEITURA_SUCCESS_RATE` | No | `0.8` | Mock success rate (0.0–1.0) |
| `WEBHOOK_URL` | No | — | URL called on successful NFS-e issuance |

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Get JWT token |

**Request:**
```json
{ "email": "admin@demo.com", "password": "admin" }
```
**Response:** `200 OK`
```json
{ "token": "eyJ...", "userId": "uuid" }
```

### Certificates

> All endpoints require `Authorization: Bearer <token>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/certificates` | Upload PFX certificate (multipart/form-data) |
| GET | `/certificates` | List user certificates |

**Upload fields:** `certificate` (file), `password` (string)

### Sales

> All endpoints require `Authorization: Bearer <token>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sales` | Create and enqueue a new sale |
| GET | `/sales` | List all user sales |
| GET | `/sales/:id` | Get a specific sale |

**Create sale request:**
```json
{ "amount": 100.00, "description": "Web development services" }
```
**Response:** `202 Accepted`
```json
{
  "id": "uuid",
  "status": "PROCESSING",
  "amount": 100.00,
  "description": "Web development services"
}
```

---

## 🗃️ Database Models

```prisma
model User {
  id        String        @id @default(uuid())
  email     String        @unique
  password  String        // bcrypt hash
  certificates Certificate[]
  sales        Sale[]
}

model Certificate {
  id                String  @id @default(uuid())
  userId            String
  filename          String  // stored in /app/uploads
  encryptedPassword String  // AES-256-CBC encrypted
}

model Sale {
  id          String     @id @default(uuid())
  userId      String
  amount      Float
  description String
  status      SaleStatus // PROCESSING | SUCCESS | ERROR
  protocol    String?    // set on success
  errorMsg    String?    // set on error
  jobId       String?    @unique
}
```

---

## 🔄 Processing Flow

1. Client calls `POST /sales`
2. API creates a `Sale` with `status: PROCESSING` and enqueues a BullMQ job
3. API returns `202 Accepted` with the sale object
4. Worker picks up the job:
   a. Generates a simplified NFS-e XML
   b. Signs the XML using the user's PFX certificate (via node-forge)
   c. Calls `POST /nfse/emitir` on prefeitura-mock
   d. prefeitura-mock waits 2 seconds, then randomly succeeds (80%) or fails (20%)
   e. On success: updates sale to `SUCCESS`, stores protocol, triggers webhook
   f. On failure: updates sale to `ERROR`, stores error message
5. Frontend polls `GET /sales` every 5 seconds to display updates

---

## 🧪 Development

### Running locally (without Docker)

```bash
# Start dependencies
docker compose up db redis prefeitura-mock -d

# Backend API
cd backend
cp ../.env.example .env
# edit .env with local DATABASE_URL etc.
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# Worker
cd worker
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

---

## 🏗️ Project Structure

```
InvoiceFlow/
├── backend/                 # Express API
│   ├── prisma/              # Schema + seed
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── middlewares/     # Auth, upload, error handler
│   │   ├── routes/          # Route definitions
│   │   └── services/        # Business logic
│   └── Dockerfile
├── worker/                  # BullMQ worker
│   ├── src/
│   │   ├── crypto/          # PFX signing
│   │   ├── processors/      # Sale job processor
│   │   ├── services/        # Prefeitura + webhook
│   │   └── xml/             # Invoice XML generation
│   └── Dockerfile
├── prefeitura-mock/         # Government API simulator
│   ├── src/
│   └── Dockerfile
├── frontend/                # React + Vite app
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/      # Shared components
│   │   ├── hooks/           # Custom hooks
│   │   └── pages/           # Page components
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔒 Security Notes

- JWT tokens expire in 24 hours
- Certificate passwords are encrypted with AES-256-CBC before storage
- File uploads are restricted to `.pfx`/`.p12` (max 5MB)
- Secrets are never committed (see `.gitignore`)
- Plaintext passwords are never stored

---

## ⚠️ Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Shared uploads volume | Simple but doesn't scale horizontally; production should use object storage (S3) |
| Shared Prisma schema | Keeps worker and API in sync but requires duplication; a shared package would be cleaner |
| localStorage for JWT | Simple but less secure than httpOnly cookies; acceptable for this scope |
| Mock XML signing | Production would use proper xmldsig; node-forge is used for PFX parsing + hash |
