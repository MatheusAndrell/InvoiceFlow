# InvoiceFlow - Emissor de NFS-e Simplificado

Aplicação full stack containerizada para simular emissão de NFS-e com processamento assíncrono, prefeitura mock e webhook.

## Stack

- Backend: Node.js + TypeScript + Express + Prisma
- Frontend: React + Vite
- Banco: PostgreSQL
- Fila: Redis + BullMQ
- Infra: Docker + Docker Compose

## Serviços Docker

- `api` (porta `3000`)
- `worker`
- `db` (PostgreSQL)
- `prefeitura-mock` (porta `3001`)
- `redis`
- `frontend` (porta `8080`)

## Como rodar

1. Copie as variáveis de ambiente:

```bash
cp .env.example .env
```

2. Suba tudo:

```bash
docker compose up -d --build
```

3. Verifique status:

```bash
docker compose ps
```

4. Acesse a aplicação:

- Frontend: `http://localhost:8080`
- API health: `http://localhost:3000/health`

## Variáveis de ambiente

Veja o arquivo `.env.example`.

Principais variáveis:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `JWT_SECRET`
- `ENCRYPTION_SECRET`
- `PREFEITURA_SUCCESS_RATE`
- `WEBHOOK_URL` (opcional)

## Usuário de demonstração (seed)

- Email: `admin@demo.com`
- Senha: `admin`

## Endpoints principais (API)

### Auth

- `POST /auth/login`

Payload:

```json
{
  "email": "admin@demo.com",
  "password": "admin"
}
```

### Certificados (autenticado)

- `POST /certificates` (multipart form-data: `certificate`, `password`)
- `GET /certificates`

### Sales / NFS-e (autenticado)

- `POST /sales` → retorna `202 Accepted` com `saleId` e status inicial `PROCESSING`
- `GET /sales`
- `GET /sales/:id`

Payload do `POST /sales`:

```json
{
  "amount": 1200.5,
  "description": "Serviço de consultoria"
}
```

## Fluxo funcional

1. Usuário faz login e recebe JWT.
2. Usuário envia certificado `.pfx/.p12` com senha.
3. Usuário cria sale (`POST /sales`).
4. API persiste a sale com status `PROCESSING` e enfileira job no BullMQ.
5. Worker consome job, gera XML simplificado, assina e envia para `prefeitura-mock` (HTTP).
6. Status da sale muda para `SUCCESS`/`ERROR`.
7. Em caso de sucesso, worker dispara webhook (`WEBHOOK_URL`).

## Atualizações em tempo real (SSE)

O frontend recebe atualizações de status das vendas em tempo real via **Server-Sent Events**, sem necessidade de recarregar a página.

- **Backend** expõe `GET /sales/events` (autenticado) que emite eventos SSE.
- **Worker** publica atualizações via Redis Pub/Sub (`sale:updates:{userId}`).
- **Frontend** conecta automaticamente ao SSE após login; a tabela de vendas atualiza sozinha.
- **Nginx** está configurado com `proxy_buffering off` e `proxy_read_timeout 86400s` para manter a conexão SSE aberta.

## Componentização (Atomic Design)

O frontend foi refatorado usando a metodologia **Atomic Design**:

```
frontend/src/components/
├── atoms/        → Button, Input, Badge, Logo, FeedbackMessage
├── molecules/    → FormField, StatusIndicator, CertificateItem, Modal
├── organisms/    → AppHeader, SaleForm, SalesTable, SaleDetailModal,
│                   LoginForm, CertificateUploadForm, CertificateList
└── templates/    → AuthLayout, DashboardLayout
```

As 3 páginas (`LoginPage`, `DashboardPage`, `CertificatePage`) consomem apenas esses componentes reutilizáveis.

---

## Diferenciais implementados

### 1. Retries / Backoff e Idempotência

O worker possui proteções robustas contra falhas e duplicação:

| Mecanismo | Descrição |
|---|---|
| **Distributed Lock** | Redis `SET NX EX` com TTL de 60s impede processamento simultâneo da mesma venda |
| **Idempotência** | Se a sale já tem status `SUCCESS` ou `ERROR`, o worker pula o processamento |
| **Classificação de erro** | Erros **transientes** (timeout, ECONNREFUSED) fazem re-throw para BullMQ retry; erros **definitivos** (rejeição da prefeitura) marcam `ERROR` sem retry |
| **BullMQ backoff** | 3 tentativas com backoff exponencial (delay inicial de 1s) |
| **Retry no serviço de prefeitura** | `callPrefeitura` faz até 3 tentativas internas com backoff exponencial (2s, 4s) para erros de rede |

**Testar retries manualmente:**

```powershell
# Derrubar o prefeitura-mock causa erros transientes (ECONNREFUSED)
docker compose stop prefeitura-mock

# Criar uma venda (ela ficará em PROCESSING com retries)
.\scripts\smoke-test.ps1 -ApiBaseUrl "http://localhost:3000"

# Ver os logs de retry no worker
docker compose logs worker --tail 20

# Subir o mock de volta — a venda será processada no próximo retry
docker compose start prefeitura-mock
```

### 2. Testes unitários do emissor (Worker)

Framework: **Vitest 1.6**. 5 suítes de teste com 20 testes cobrindo todo o pipeline de emissão.

| Arquivo | O que testa |
|---|---|
| `invoice.xml.test.ts` | Geração de XML NFS-e, escape de caracteres especiais |
| `prefeitura.service.test.ts` | Chamada HTTP, retry em erros de rede, respeito a `MAX_RETRIES` |
| `sale.processor.test.ts` | Idempotência, lock distribuído, fluxo SUCCESS/ERROR, transient vs definitive errors |
| `sign.test.ts` | Assinatura com PFX real (senha correta), fallback mock (senha errada), arquivo inexistente |
| `webhook.service.test.ts` | Disparo de webhook, skip quando URL não configurada, resiliência a falhas |

**Rodar os testes:**

```bash
cd worker
npm test            # Execução única
npm run test:watch  # Modo watch (desenvolvimento)
```

**Rodar um teste específico:**

```bash
cd worker
npx vitest run tests/sign.test.ts
npx vitest run tests/sale.processor.test.ts
```

### 3. CI simples (GitHub Actions)

Pipeline em `.github/workflows/ci.yml` acionado em push para `main`/`develop` e pull requests para `main`.

**4 jobs paralelos:**

| Job | Etapas |
|---|---|
| **Backend** | `npm ci` → `prisma generate` → `tsc --noEmit` (lint) → `tsc` (build) |
| **Worker** | `npm ci` → `prisma generate` → `tsc --noEmit` (lint) → `vitest run` (testes) → `tsc` (build) |
| **Frontend** | `npm ci` → `tsc --noEmit` (lint) → `tsc && vite build` (build) |
| **Docker** | `docker compose build` (roda após os 3 acima passarem) |

**Rodar o lint localmente (mesmo que o CI faz):**

```bash
# Backend
cd backend && npm run lint

# Worker
cd worker && npm run lint

# Frontend
cd frontend && npm run lint
```

### 4. Reverse Proxy Nginx (hardened)

O Nginx em `frontend/nginx.conf` vai além de um proxy simples:

**Security headers:**
- `X-Frame-Options: SAMEORIGIN` — proteção contra clickjacking
- `X-Content-Type-Options: nosniff` — impede MIME-type sniffing
- `X-XSS-Protection: 1; mode=block` — proteção XSS legacy
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — limita fontes de script/style/connect a `'self'`

**Performance:**
- Gzip habilitado para JSON, JS, CSS, XML (min 256 bytes)
- Cache de 1h para assets estáticos do SPA

**Rate limiting:**
- 30 req/s por IP com burst de 10 nas rotas `/auth`, `/certificates`, `/sales`
- Protege contra brute force e abuso

**Proxy:**
- Headers `X-Forwarded-For` e `X-Forwarded-Proto` em todas as rotas
- `client_max_body_size 5M` para uploads de certificado
- SSE com `proxy_buffering off` e timeout de 24h

**Verificar headers:**

```powershell
$r = Invoke-WebRequest -Uri http://localhost:8080 -UseBasicParsing
$r.Headers["X-Frame-Options"]         # SAMEORIGIN
$r.Headers["X-Content-Type-Options"]   # nosniff
$r.Headers["Content-Security-Policy"]  # default-src 'self' ...
```

### 5. Workflow N8n (export)

Arquivo: `n8n/workflow-webhook.json` — workflow importável no N8n para consumir o webhook de emissão.

**Nodes do workflow:**

```
Webhook Trigger (POST /invoiceflow-webhook)
   ├── Check Status (IF: status === SUCCESS)
   │     ├── true  → Email – Sucesso (protocolo + saleId)
   │     └── false → Email – Erro (saleId + errorMsg)
   └── Set Log Data (extrai event, saleId, protocol, timestamp)
```

**Como usar:**

O N8n já sobe junto com os demais serviços via Docker Compose (porta `5678`). O `WEBHOOK_URL` do worker já aponta para ele por padrão.

1. Suba o ambiente normalmente:
   ```bash
   docker compose up -d --build
   ```

2. Acesse o N8n em `http://localhost:5678` e crie uma conta.

3. Importe o workflow:
   - Vá em **Workflows → Import from File**
   - Selecione `n8n/workflow-webhook.json`
   - Ative o workflow

4. Crie uma venda (pelo frontend ou smoke test) e veja a execução no painel do N8n.

> Para usar uma URL customizada, defina `WEBHOOK_URL` no `.env` e reinicie: `docker compose restart worker`

> **Nota:** Os nodes de email precisam de credenciais SMTP configuradas no N8n. Para teste rápido, substitua por um node "Set" ou "Code" para apenas logar o payload.

---

## Decisões de arquitetura e trade-offs

- Assinatura digital simplificada: o worker usa o certificado para extrair dados e gerar uma assinatura mock baseada em hash no XML. Não implementa assinatura ICP-Brasil completa.
- Segurança da senha do certificado: senha é armazenada criptografada (AES-256-CBC) no banco; não é salva em plaintext.
- Processamento assíncrono: emissão não acontece dentro da request do `POST /sales`.
- Confiabilidade: fila com `attempts` + `exponential backoff`; lock distribuído via Redis; classificação de erros transientes vs definitivos; idempotência via status check.
- Prefeitura separada: integração via HTTP para serviço independente (`prefeitura-mock`), com delay simulado de ~2s e resposta randômica.
- Real-time: SSE + Redis Pub/Sub para atualizar o frontend sem polling.
- Frontend Atomic Design: componentes reutilizáveis organizados em atoms → molecules → organisms → templates → pages.

## Limitações conhecidas

- Não há assinatura XML padrão ABRASF completa (apenas simulação controlada para o desafio).
- Não há autenticação de webhook por assinatura/HMAC.

## Entrega de demonstração

- Plano A (deploy público): **não incluído**.
- Plano B (vídeo 2–4 min): **pendente de anexar link**.

Checklist sugerido para o vídeo:

1. `docker compose up -d --build`
2. Login no frontend
3. Upload de certificado
4. Criação de sale
5. Mudança de status `PROCESSING -> SUCCESS/ERROR` (em tempo real via SSE)
6. Rodar testes: `cd worker && npm test`

## Smoke test

Para validação rápida da API, rode:

```powershell
.\scripts\smoke-test.ps1 -ApiBaseUrl "http://localhost:3000"
```

Com upload de certificado:

```powershell
.\scripts\smoke-test.ps1 -ApiBaseUrl "http://localhost:3000" -CertificatePath "certs\test-cert.pfx" -CertificatePassword "123456"
```

O script executa: healthcheck → login → upload do certificado (opcional) → criação de sale → polling até status final.
