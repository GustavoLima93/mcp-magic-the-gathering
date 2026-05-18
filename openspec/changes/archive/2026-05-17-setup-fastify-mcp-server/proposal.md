# Proposal: Bootstrap do Fastify MCP Server com versão configurável e health tool

## O que será feito?
Vamos evoluir a configuração inicial para subir um servidor MCP em Fastify já com:
- metadados configuráveis do servidor (incluindo versão),
- transporte HTTP/SSE preparado,
- e uma tool simples de health check para validar que a estrutura está operacional.

## Por que?
Hoje o bootstrap inicial não deixa explícito como versionar o servidor MCP por ambiente nem oferece uma verificação funcional mínima do protocolo.

Com essa mudança, teremos um baseline mais seguro para evoluir as próximas tools de negócio:
- configuração previsível por ambiente (`.env`),
- identificação clara de versão em runtime,
- e uma validação rápida equivalente ao health check de uma API REST, mas via tool MCP.

## Escopo
- Criar `src/infra/env/env.ts` com Zod para validar e normalizar:
  - `NODE_ENV`, `HOST`, `PORT`,
  - `MCP_SERVER_NAME`, `MCP_SERVER_VERSION`,
  - `MCP_MESSAGES_PATH`, `MCP_SSE_PATH`.
- Configurar `src/app.ts` para inicializar Fastify e preparar os endpoints do transporte MCP.
- Configurar `src/server.ts` para subir o HTTP server usando as variáveis validadas.
- Registrar a tool MCP `health_check` retornando status operacional e metadados básicos do servidor.
- Atualizar `.env.example` com os defaults da configuração inicial.

## Critérios de sucesso
- O servidor inicia com configuração default sem erro.
- A versão do MCP server pode ser alterada por variável de ambiente sem alteração de código.
- A tool `health_check` responde com `status: "ok"` e metadados mínimos (`serverName`, `version`, `timestamp`, `uptimeSeconds`).

## Fora de escopo nesta change
- Integração com Scryfall.
- Implementação das tools de negócio (ex.: `search_cards`).
- Observabilidade avançada (métricas, tracing, readiness/liveness externos).
