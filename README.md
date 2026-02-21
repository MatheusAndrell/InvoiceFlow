
# InvoiceFlow – Emissor de NFS-e Simplificado

**InvoiceFlow** é uma solução full stack robusta e containerizada para emissão simulada de NFS-e, com arquitetura moderna, processamento assíncrono, integração via webhook e ambiente de demonstração em produção. O projeto foi desenvolvido com foco em confiabilidade, segurança, escalabilidade e práticas maduras de engenharia de software.


## Stack Tecnológica

- **Backend:** Node.js + TypeScript + Express + Prisma
- **Frontend:** React + Vite
- **Banco de Dados:** PostgreSQL
- **Fila:** Redis + BullMQ
- **Infraestrutura:** Docker + Docker Compose


## Serviços Docker

- `api` (porta `3000`)
- `worker`
- `db` (PostgreSQL)
- `prefeitura-mock` (porta `3001`)
- `redis`
- `frontend` (porta `8080`)


---

## Demonstração Online

A aplicação está disponível publicamente para avaliação:

- **Frontend:** http://35.185.50.100:8080/
- **API Health Check:** http://35.185.50.100:3000/health
- **n8n (Painel):** http://35.185.50.100:5678/

> Ambiente hospedado em VM na GCP utilizando Docker Compose.
> O Nginx atua como reverse proxy e único ponto de entrada público.
> Esta instância é destinada exclusivamente para demonstração técnica.
---

## Workflow Automation (N8n)

O ambiente inclui um serviço N8n para demonstrar consumo automatizado do webhook de emissão.

O workflow pode ser importado a partir de:
`n8n/workflow-webhook.json`

> No ambiente Docker local o N8n sobe automaticamente na porta 5678.
> Em produção real, esse serviço não seria exposto publicamente.
---

## Como rodar localmente

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


## Variáveis de Ambiente

Veja o arquivo `.env.example`.

Principais variáveis:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `JWT_SECRET`
- `ENCRYPTION_SECRET`
- `PREFEITURA_SUCCESS_RATE`
- `WEBHOOK_URL` (opcional)



## Usuário de Demonstração (Seed)

- Email: `admin@demo.com`
- Senha: `admin`


## Certificado de Teste (.pfx)

**Importante:** Não commite nenhum arquivo de certificado (.pfx/.p12) no repositório. Para testar o upload de certificado, gere um arquivo de teste localmente usando OpenSSL:

### Como gerar um certificado .pfx de teste

1. Gere uma chave privada e um certificado autoassinado:

```bash
openssl req -x509 -newkey rsa:2048 -keyout test-key.pem -out test-cert.pem -days 365 -nodes -subj "/CN=Teste NFS-e"
```

2. Converta para .pfx:

```bash
openssl pkcs12 -export -out test-cert.pfx -inkey test-key.pem -in test-cert.pem -password pass:123456
```

O arquivo `test-cert.pfx` será gerado com a senha `123456`. Use esse arquivo para testar o upload no sistema.

> Não utilize certificados reais. O arquivo gerado é apenas para fins de teste.


## Endpoints Principais (API)

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


## Fluxo Funcional

1. Usuário faz login e recebe JWT.
2. Usuário envia certificado `.pfx/.p12` com senha.
3. Usuário cria sale (`POST /sales`).
4. API persiste a sale com status `PROCESSING` e enfileira job no BullMQ.
5. Worker consome job, gera XML simplificado, assina e envia para `prefeitura-mock` (HTTP).
6. Status da sale muda para `SUCCESS`/`ERROR`.
7. Em caso de sucesso, worker dispara webhook (`WEBHOOK_URL`).


## Atualizações em Tempo Real (SSE)

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


## Diferenciais Implementados


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


### 2. Testes Unitários do Emissor (Worker)

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


### 3. CI Automatizado (GitHub Actions)

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


### 4. Reverse Proxy Nginx (Hardened)

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


### 5. Workflow N8n (Export)

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


## Decisões de Arquitetura e Trade-offs


- **Assinatura digital simplificada:** O worker utiliza o certificado para extrair dados e gerar uma assinatura mock baseada em hash do XML, simulando o fluxo real sem implementar a assinatura ICP-Brasil completa, o que permite foco em arquitetura e resiliência.
- **Segurança da senha do certificado:** A senha do certificado é armazenada criptografada (AES-256-CBC) no banco, nunca em texto puro.
- **Processamento assíncrono:** A emissão ocorre fora do ciclo da request do `POST /sales`, garantindo escalabilidade e resiliência.
- **Confiabilidade:** Fila com tentativas automáticas, backoff exponencial, lock distribuído via Redis, classificação de erros transientes/definitivos e idempotência por status.
- **Prefeitura desacoplada:** Integração via HTTP com serviço independente (`prefeitura-mock`), simulando delays e falhas reais.
- **Real-time:** SSE + Redis Pub/Sub para atualização instantânea do frontend sem polling.
- **Frontend Atomic Design:** Componentização rigorosa para máxima reutilização e manutenibilidade.


---

## Considerações de Segurança

O InvoiceFlow foi projetado com múltiplos controles de segurança e práticas recomendadas para ambientes de produção:

- **Expiração de JWT:** Tokens de autenticação possuem tempo de expiração configurável, reduzindo riscos em caso de vazamento.
- **Criptografia AES-256-CBC:** Senhas de certificados são armazenadas criptografadas no banco, nunca em texto puro.
- **Rate Limiting no Nginx:** Limite de 30 requisições/s por IP (burst 10) nas rotas sensíveis, mitigando brute force e abusos.
- **Security Headers:** Nginx aplica CSP restritiva, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy e outros headers para defesa em profundidade.
- **Lock Distribuído:** Redis SET NX EX previne processamento concorrente da mesma venda, protegendo contra race conditions.
- **Idempotência:** O worker garante que vendas já processadas (SUCCESS/ERROR) não sejam reprocessadas, evitando duplicidade.
- **.env não versionado:** Variáveis sensíveis nunca são versionadas, seguindo boas práticas DevSecOps.

### Recomendações de Hardening para Produção

- **Secret Manager (GCP/AWS):** Gerencie segredos e variáveis sensíveis fora do ambiente Docker, usando serviços como Google Secret Manager ou AWS Secrets Manager.
- **Assinatura HMAC em Webhook:** Implemente assinatura HMAC para autenticação e integridade dos webhooks enviados.
- **Containers sem root:** Execute todos os containers com usuários não-root, minimizando superfície de ataque.
- **Object Storage para Certificados:** Armazene certificados em serviços como GCS, S3 ou Azure Blob, evitando persistência local.
- **Observabilidade e Alertas:** Implemente monitoramento, tracing e alertas para falhas, filas, erros e tentativas de ataque.
- **Dead-letter Queue:** Configure DLQ para jobs que excederem o número máximo de tentativas, garantindo rastreabilidade e análise de falhas.

---

## Limitações e Escopos Deliberados

- **Assinatura ABRASF:** O projeto simula a assinatura digital padrão ABRASF para fins de demonstração e arquitetura, não sendo adequado para produção fiscal real.
- **Webhook sem HMAC:** A autenticação de webhooks é opcional e pode ser expandida conforme requisitos de segurança do ambiente alvo.

Essas decisões foram tomadas para priorizar clareza arquitetural, segurança de fluxo e facilidade de demonstração, mantendo o código pronto para extensões e integrações reais.
