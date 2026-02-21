# InvoiceFlow

Simulador completo de emissor NFS-e em contêineres, com processamento assíncrono, assinatura de certificados, filas de trabalho e integração simulada com o governo.

---

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Configuração do ambiente](#configuração-do-ambiente)
- [Subindo os serviços com Docker](#subindo-os-serviços-com-docker)
- [Passo a passo para testar](#passo-a-passo-para-testar)
- [Variáveis de ambiente](#variáveis-de-ambiente)

---

## Pré-requisitos

Certifique-se de ter instalado em sua máquina:

- [Docker](https://www.docker.com/get-started) (versão 20+)
- [Docker Compose](https://docs.docker.com/compose/install/) (versão 2+)
- [Git](https://git-scm.com/)

---

## Configuração do ambiente

1. **Clone o repositório:**

   ```bash
   git clone https://github.com/MatheusAndrell/InvoiceFlow.git
   cd InvoiceFlow
   ```

2. **Copie o arquivo de variáveis de ambiente:**

   ```bash
   cp .env.example .env
   ```

3. **Edite o `.env` conforme necessário** (veja a seção [Variáveis de ambiente](#variáveis-de-ambiente)):

   ```bash
   nano .env
   # ou use o editor de sua preferência
   ```

   > Para testes locais, os valores padrão do `.env.example` já funcionam sem alterações.

---

## Subindo os serviços com Docker

```bash
docker compose up -d
```

Esse comando sobe todos os serviços definidos no `docker-compose.yml`:

| Serviço      | Descrição                          | Porta padrão |
|--------------|------------------------------------|--------------|
| `app`        | API da aplicação InvoiceFlow       | `3000`       |
| `postgres`   | Banco de dados PostgreSQL          | `5432`       |
| `rabbitmq`   | Fila de mensagens RabbitMQ         | `5672`       |
| `redis`      | Cache Redis                        | `6379`       |
| `gov-mock`   | Mock da API governamental de NFS-e | `8080`       |

Para verificar se os contêineres estão em execução:

```bash
docker compose ps
```

---

## Passo a passo para testar

### 1. Verifique que a aplicação está online

```bash
curl http://localhost:3000/health
```

Resposta esperada:

```json
{ "status": "ok" }
```

### 2. Emita uma NFS-e de teste

```bash
curl -X POST http://localhost:3000/nfse \
  -H "Content-Type: application/json" \
  -d '{
    "prestador": {
      "cnpj": "00.000.000/0001-00",
      "inscricaoMunicipal": "123456"
    },
    "tomador": {
      "cpfCnpj": "111.222.333-44",
      "razaoSocial": "Empresa Tomadora Ltda"
    },
    "servico": {
      "valorServicos": 1500.00,
      "issRetido": false,
      "itemListaServico": "01.01",
      "discriminacao": "Prestação de serviços de desenvolvimento de software"
    }
  }'
```

### 3. Consulte a NFS-e emitida

Após a emissão, você receberá um `numero` na resposta. Use-o para consultar:

```bash
curl http://localhost:3000/nfse/{numero}
```

### 4. Acompanhe a fila de processamento

Acesse o painel do RabbitMQ para monitorar as filas:

```
URL:    http://localhost:15672
Usuário: guest
Senha:   guest
```

### 5. Veja os logs da aplicação

```bash
docker compose logs -f app
```

### 6. Encerrando os serviços

```bash
docker compose down
```

Para remover também os volumes de dados:

```bash
docker compose down -v
```

---

## Variáveis de ambiente

O arquivo `.env.example` contém todas as variáveis disponíveis com valores padrão para desenvolvimento local. Abaixo estão as principais:

| Variável              | Descrição                                      | Padrão               |
|-----------------------|------------------------------------------------|----------------------|
| `APP_ENV`             | Ambiente da aplicação                          | `development`        |
| `APP_PORT`            | Porta da API                                   | `3000`               |
| `APP_SECRET`          | Chave secreta da aplicação                     | *(troque em produção)* |
| `DB_HOST`             | Host do banco de dados                         | `localhost`          |
| `DB_PORT`             | Porta do banco de dados                        | `5432`               |
| `DB_NAME`             | Nome do banco de dados                         | `invoiceflow`        |
| `DB_USER`             | Usuário do banco de dados                      | `invoiceflow_user`   |
| `DB_PASSWORD`         | Senha do banco de dados                        | `invoiceflow_pass`   |
| `RABBITMQ_HOST`       | Host do RabbitMQ                               | `localhost`          |
| `RABBITMQ_PORT`       | Porta do RabbitMQ                              | `5672`               |
| `REDIS_HOST`          | Host do Redis                                  | `localhost`          |
| `REDIS_PORT`          | Porta do Redis                                 | `6379`               |
| `CERT_PATH`           | Caminho para o certificado digital (.pfx)      | `./certs/certificado.pfx` |
| `CERT_PASSWORD`       | Senha do certificado digital                   | *(preencha)*         |
| `GOV_API_URL`         | URL do mock da API governamental               | `http://localhost:8080/nfse` |
| `NFSE_MUNICIPIO_CODIGO` | Código IBGE do município                    | `3550308` (São Paulo) |
| `NFSE_AMBIENTE`       | Ambiente NFS-e (1=Produção, 2=Homologação)     | `2`                  |

> **Atenção:** nunca faça commit do arquivo `.env` com dados reais em repositórios públicos.
