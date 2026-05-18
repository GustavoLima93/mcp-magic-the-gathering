# Tasks: Bootstrap do Fastify MCP Server com health tool

- [x] 1. Criar `src/infra/env/env.ts` com schema Zod para `NODE_ENV`, `HOST`, `PORT`, `MCP_SERVER_NAME`, `MCP_SERVER_VERSION`, `MCP_MESSAGES_PATH` e `MCP_SSE_PATH`.
- [x] 2. Atualizar `.env.example` com defaults coerentes da fase inicial.
- [x] 3. Implementar bootstrap em `src/app.ts` com Fastify + transporte MCP usando os paths configuráveis.
- [x] 4. Configurar `src/server.ts` para iniciar o app com `host`/`port` vindos do env validado.
- [x] 5. Registrar a tool MCP `health_check` sem argumentos, retornando `status`, `serverName`, `version`, `timestamp` e `uptimeSeconds`.
- [x] 6. Garantir comportamento fail-fast para env inválido durante startup.
- [x] 7. Subir servidor com defaults e validar startup sem erro.
- [x] 8. Subir servidor com `MCP_SERVER_VERSION` customizada e validar metadata.
- [x] 9. Invocar `health_check` e validar payload esperado.
