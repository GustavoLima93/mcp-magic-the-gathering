## Arquitetura

Este projeto segue uma arquitetura hexagonal com DDD tático. A estrutura
principal é organizada em três camadas: domínio, application e infraestrutura.

### Domínio

Objetivo: concentrar regras de negócio, entidades, value objects e contratos,
totalmente independente de frameworks e bibliotecas. Código puro em TypeScript.

Diretrizes:
- Nenhuma dependência de infraestrutura, web, banco, HTTP, SDKs, libs de
  terceiros ou frameworks.
- Modelos de domínio, erros de domínio, contratos e use cases ficam aqui.
- Use cases de domínio devem expor regras e payloads sem conhecer MCP, Fastify
  ou Pino.

Pastas atuais relacionadas:
- `src/domain`
- `src/domain/entity`
- `src/domain/entity/models`
- `src/domain/use-case`

### Application

Objetivo: orquestrar casos de uso e adaptar entradas e saídas para a borda da
aplicação. A camada application depende do domínio, mas não de infraestrutura
concreta.

Diretrizes:
- Controllers de tools MCP ficam em `src/application/controller`.
- Controllers chamam use cases de domínio e formatam a resposta esperada pelas
  tools.
- Tipos compartilhados de entrada e saída da camada ficam em
  `src/application/types`.
- Não inicializar Fastify, transports MCP, logger concreto, env ou clientes
  externos nesta camada.

Pastas atuais relacionadas:
- `src/application`
- `src/application/controller`
- `src/application/types`

### Infraestrutura

Objetivo: concentrar todo código que depende de frameworks, SDKs e bibliotecas.
Implementa adaptadores concretos para HTTP, MCP, configuração, logging,
clientes externos e outros detalhes operacionais.

Diretrizes:
- Implementa as interfaces e contratos definidos no domínio ou application.
- Contém detalhes de framework, SDKs, clients, configs, middlewares e logs.
- É a única camada que deve conhecer Fastify, SDK MCP, dotenv, Zod de env e
  Pino.

Pastas atuais relacionadas:
- `src/infra`
- `src/infra/env`
- `src/infra/http`
- `src/infra/http/middleware`
- `src/infra/log`

#### `src/infra/http/server.ts`

Responsável por agrupar a configuração do servidor MCP.

Responsabilidades:
- Criar o `McpServer` usando `MCP_SERVER_NAME` e `MCP_SERVER_VERSION`.
- Gerenciar sessões MCP em memória.
- Criar e conectar `StreamableHTTPServerTransport`.
- Fechar sessões, transports e server resources com log de falhas.
- Expor `setTool` como ponto único para registro de tools no MCP server.
- Exportar `isInitializeRequest` para o middleware HTTP validar o fluxo MCP.

Novas tools devem ser registradas por meio do `server.setTool(...)`, de
preferência em `src/infra/http/app.ts` ou em um módulo de composição da camada
infra.

#### `src/infra/http/app.ts`

Responsável pela configuração do framework web Fastify e pela composição da
entrada HTTP da aplicação.

Responsabilidades:
- Criar a instância Fastify com o logger Pino da aplicação.
- Registrar controllers application como tools MCP.
- Registrar rotas Fastify para `MCP_MESSAGES_PATH` e `MCP_SSE_PATH`.
- Delegar o processamento MCP para middlewares da pasta
  `src/infra/http/middleware`.
- Fechar sessões MCP no hook `onClose` do Fastify.

#### `src/infra/http/middleware`

Concentra middlewares e handlers de borda do Fastify.

Responsabilidades:
- Interpretar requests HTTP do Fastify.
- Resolver sessão MCP por header `mcp-session-id`.
- Criar transport session apenas para requests MCP de inicialização.
- Encaminhar requests válidos ao transport MCP.
- Traduzir falhas de borda para respostas HTTP e logs de infraestrutura.

#### `src/infra/log`

Concentra o logger da aplicação.

Responsabilidades:
- Criar e exportar a instância Pino usada por Fastify, startup e infraestrutura.
- Exportar o tipo `Logger` quando a injeção explícita for necessária.

### Entradas principais

Arquivos de bootstrap e composição ficam em:
- `src/startup.ts`: inicia o servidor HTTP com `host` e `port` vindos de
  `src/infra/env`.
- `src/infra/http/app.ts`: configura Fastify, rotas MCP e registro de tools.
- `src/infra/http/server.ts`: configura o servidor MCP, transports e sessões.

### OpenSpec

Antes de alterar arquivos em `openspec/`, use o OpenSpec CLI para consultar o
estado da change.

Change ativa analisada:
- `setup-fastify-mcp-server`

Comandos úteis:
- `pnpm exec openspec list --json`
- `pnpm exec openspec status --change setup-fastify-mcp-server --json`
- `pnpm exec openspec instructions apply --change setup-fastify-mcp-server --json`
- `pnpm exec openspec validate --all --strict --json`

Se o shell do agente não encontrar `pnpm` ou `node`, use o PATH da instalação
NVM local:

```sh
env PATH=/Users/ghlima/.nvm/versions/node/v24.15.0/bin:/Users/ghlima/Library/pnpm:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin pnpm exec openspec validate --all --strict --json
```

Observação: a versão atual do CLI expõe `validate` para validação. Não há
comando `openspec verify` disponível neste ambiente.
