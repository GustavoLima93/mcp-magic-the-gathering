# Design: Bootstrap do Fastify MCP Server (configurável + health tool)

## Contexto
Conforme o TDD (`docs/mcp-mtg-scryfall-tdd.md`), o servidor usará Fastify com transporte HTTP/SSE para MCP.
Nesta etapa inicial, priorizamos um bootstrap funcional e validável, sem dependência das tools de negócio.

## Decisões de arquitetura

### 1. Contrato de ambiente (fail-fast)
`src/infra/env/env.ts` usará `zod` para validar e transformar configuração em runtime.

Variáveis desta fase:
- `NODE_ENV`: `development | test | production` (default: `development`)
- `HOST`: host do HTTP server (default: `0.0.0.0`)
- `PORT`: porta do HTTP server (default: `3000`)
- `MCP_SERVER_NAME`: nome publicado no metadata MCP (default: `mcp-node`)
- `MCP_SERVER_VERSION`: versão publicada no metadata MCP (default: `0.1.0`)
- `MCP_MESSAGES_PATH`: endpoint de mensagens MCP (default: `/mcp/messages`)
- `MCP_SSE_PATH`: endpoint SSE MCP (default: `/mcp/sse`)

Se qualquer valor inválido for informado, o processo deve falhar na inicialização com erro claro.

### 2. Bootstrap Fastify e transporte MCP
`src/app.ts` será responsável por:
- criar a instância Fastify,
- montar o transporte MCP nos paths configurados,
- registrar handlers necessários para tráfego HTTP/SSE.

`src/server.ts` ficará somente com a responsabilidade de startup:
- carregar env validado,
- iniciar `app.listen({ host, port })`,
- logar endpoint ativo.

### 3. Metadados versionados do servidor MCP
Na criação do MCP server, usar `MCP_SERVER_NAME` e `MCP_SERVER_VERSION` para preencher `serverInfo`.
Isso garante versionamento por ambiente sem editar código.

### 4. Tool inicial de validação: `health_check`
Para validar o baseline do servidor, será registrada uma tool MCP sem argumentos:
- **Nome**: `health_check`
- **Objetivo**: confirmar que o servidor está de pé e respondendo pelo protocolo MCP.
- **Semântica**: equivalente a um health check REST, mas exposto como tool.

Resposta esperada (exemplo):
```json
{
  "status": "ok",
  "serverName": "mcp-node",
  "version": "0.1.0",
  "timestamp": "2026-05-17T01:23:45.000Z",
  "uptimeSeconds": 12
}
```

Regras:
- não depende de integração externa (ex.: Scryfall),
- sempre retorna estado local do processo,
- em caso de erro inesperado, deve responder erro MCP estruturado.

## Alocação por camadas (hexagonal)
- **Domain**: contrato/semântica do health check (sem dependências de framework).
- **Application**: orquestração da tool e formatação de saída.
- **Infra**: Fastify, SDK MCP, roteamento HTTP/SSE e carregamento de env.

## Estratégia de validação
- Teste manual de bootstrap: subir servidor com defaults e com `MCP_SERVER_VERSION` customizada.
- Teste funcional MCP: invocar `health_check` e validar campos obrigatórios.
- Teste negativo: iniciar com valor inválido em `PORT` e validar falha imediata.
