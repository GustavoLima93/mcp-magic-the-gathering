# MCP: stateful vs stateless no Streamable HTTP

## 1. Objetivo

Este documento explica o conceito de session em um servidor MCP usando
`StreamableHTTPServerTransport`, compara os modos stateful e stateless, e
discute os impactos práticos para deploy em Kubernetes com múltiplos pods.

Ele usa como referência o código atual de [`src/app.ts`](../src/app.ts), que
hoje opera em modo stateful.

## 2. Contexto do projeto

O projeto expõe um servidor MCP com Fastify e
`@modelcontextprotocol/sdk@1.29.0`. O bootstrap HTTP fica em
[`src/app.ts`](../src/app.ts), enquanto o processo de inicialização fica em
[`src/server.ts`](../src/server.ts).

No arquivo `src/app.ts`, a session MCP é representada por:

```ts
interface SessionContext {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}
```

As sessions são guardadas em memória:

```ts
const sessions = new Map<string, SessionContext>();
```

Na prática, cada chave do `Map` é um `sessionId`, e cada valor guarda o par
`McpServer` + `StreamableHTTPServerTransport` usado por aquele cliente MCP.

## 3. O que é uma session no MCP

Uma session MCP não é a mesma coisa que login, cookie ou sessão web de usuário.
Ela é o vínculo lógico entre várias requisições HTTP feitas pelo mesmo cliente
MCP.

HTTP por si só é stateless: cada request chega isolado. O MCP, porém, tem ciclo
de vida. Um cliente inicializa a conexão, negocia capacidades, lista tools,
chama tools, pode abrir streams SSE, receber notificações e encerrar a conexão.

O `Mcp-Session-Id` resolve essa continuidade:

1. O cliente envia um `POST` com o método `initialize`.
2. O servidor cria uma session e gera um identificador.
3. O servidor devolve esse identificador no header `mcp-session-id`.
4. O cliente envia o mesmo header nos próximos requests.
5. O servidor usa esse header para encontrar o `transport` correto.
6. O cliente pode encerrar a session com `DELETE`.

Fluxo simplificado:

```text
Client -> POST /mcp/messages
          body: initialize
          sem mcp-session-id

Server -> cria session
          sessionId = randomUUID()

Server -> Client
          header: mcp-session-id: <uuid>

Client -> POST /mcp/messages
          header: mcp-session-id: <uuid>
          body: tools/list, tools/call, notifications/initialized

Client -> GET /mcp/sse ou /mcp/messages
          header: mcp-session-id: <uuid>
          abre stream SSE

Client -> DELETE /mcp/messages
          header: mcp-session-id: <uuid>
          encerra a session
```

## 4. Como o `app.ts` implementa sessions hoje

O código atual está em modo stateful porque cria o transporte com
`sessionIdGenerator`.

```ts
transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  onsessioninitialized: (sessionId) => {
    sessions.set(sessionId, {
      server,
      transport,
    });
  },
});
```

### 4.1. Mapa das partes do código

| Trecho | Responsabilidade | Impacto |
| --- | --- | --- |
| `SessionContext` | Define o que fica vivo por session. | Cada session tem um `McpServer` e um `transport`. |
| `createMcpServer()` | Cria uma instância de `McpServer` e registra a tool `health_check`. | Cada session recebe um servidor MCP novo com as mesmas tools. |
| `sessions = new Map(...)` | Armazena sessions no processo Node.js. | Sessions somem se o processo reiniciar. |
| `resolveSessionId()` | Normaliza o header `mcp-session-id`. | Evita tratar array/string de header manualmente no handler. |
| `closeSession()` | Remove a session do `Map` e fecha recursos. | Evita manter streams, handlers e recursos pendurados. |
| `createTransportSession()` | Cria o `McpServer`, o `transport`, e registra a session. | Este é o ponto onde o modo stateful é ativado. |
| `handleMcpRequest()` | Decide se usa session existente, cria nova session, ou retorna erro. | Centraliza o roteamento de requests MCP. |
| `app.route(...)` | Registra `GET`, `POST`, e `DELETE` nos caminhos MCP. | Permite requests, streams SSE e encerramento de session. |
| `app.addHook('onClose')` | Fecha todas as sessions ao desligar o Fastify. | Ajuda no graceful shutdown. |

### 4.2. Decisão do handler

O handler atual segue esta regra:

```text
Tem mcp-session-id válido?
  usa o transport existente.

Não tem session, mas é POST initialize?
  cria uma nova session.

Não é nenhum dos dois?
  retorna 400.
```

Esse desenho é compatível com servidores MCP stateful. Ele também deixa claro
que `sessions` é uma estrutura local ao processo. Em um único processo isso
funciona bem. Em múltiplos pods, exige cuidado de roteamento.

## 5. Modos do `StreamableHTTPServerTransport`

O mesmo transporte pode operar em dois modos.

### 5.1. Stateful

No modo stateful, o servidor gera e valida `mcp-session-id`.

```ts
new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});
```

Características:

- O servidor retorna `mcp-session-id` no `initialize`.
- O cliente deve enviar `mcp-session-id` nos requests seguintes.
- O servidor mantém estado em memória por session.
- O mesmo `transport` é reutilizado para aquela session.
- O servidor consegue manter streams SSE e mensagens server-to-client com mais
  naturalidade.

### 5.2. Stateless

No modo stateless, o servidor desativa o gerenciamento de session do transporte.

```ts
new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});
```

Características:

- O servidor não retorna `mcp-session-id`.
- O cliente não precisa enviar `mcp-session-id`.
- Não é necessário manter `sessions = new Map(...)`.
- Cada request deve usar um `transport` novo.
- Normalmente, cada request cria seu próprio `McpServer` e `transport`, conecta,
  processa e fecha.

Exemplo conceitual:

```ts
const server = createMcpServer();

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

await server.connect(transport);
await transport.handleRequest(request.raw, reply.raw, request.body);
```

## 6. Comparativo de tradeoffs

| Critério | Stateful | Stateless |
| --- | --- | --- |
| Funcionamento | O servidor cria uma `sessionId` no `initialize` e o cliente a envia nos próximos requests. | O servidor não cria session. Cada request é independente. |
| Configuração no SDK | `sessionIdGenerator: () => randomUUID()` | `sessionIdGenerator: undefined` |
| Estado em memória | Usa estado em memória, como `sessions = new Map(...)`. | Não precisa de mapa local de sessions MCP. |
| Reuso de transport | Reutiliza o mesmo `transport` para a mesma session. | Cria um `transport` novo por request. |
| Complexidade de código | Maior. Precisa criar, localizar, fechar e limpar sessions. | Menor. O fluxo parece mais com uma API HTTP comum. |
| Complexidade operacional | Maior. Exige TTL, cleanup, limites, observabilidade e estratégia para múltiplas instâncias. | Menor. Qualquer instância pode responder qualquer request se o estado de negócio estiver externo. |
| Escalabilidade horizontal | Mais difícil. Precisa sticky session, roteamento por `mcp-session-id`, ou arquitetura distribuída. | Mais simples. Requests podem cair em qualquer pod. |
| Kubernetes | Funciona bem com sticky sessions ou roteamento consciente de session. | Encaixa melhor em múltiplos pods sem afinidade. |
| Serverless | Menos natural, porque depende de objetos vivos entre requests. | Mais natural, porque cada invocação pode ser independente. |
| SSE persistente | Melhor suporte para stream por cliente. | Limitado; o request precisa resolver o trabalho sem depender de session viva. |
| Notificações server-to-client | Mais natural, porque o servidor conhece o transport da session. | Exige abordagem externa, como polling, filas, webhooks, ou outro canal. |
| Tarefas longas | Melhor para progresso, streaming e interação durante a tarefa. | Possível, mas geralmente exige job store, polling, Redis, banco ou fila. |
| Isolamento por cliente | Direto. Cada cliente tem seu par `server` + `transport`. | Deve ser derivado de auth, tenant, headers, body ou storage externo. |
| Recuperação após restart | Sessions em memória são perdidas. O cliente precisa reinicializar. | Mais resiliente a restart se o estado necessário estiver fora do processo. |
| Uso de memória | Cresce com o número de sessions abertas. | Tende a ser menor e mais previsível por request. |
| Risco principal | Vazamento de sessions, streams pendurados, requests indo para o pod errado. | Perder recursos MCP que dependem de continuidade e bidirecionalidade. |
| Melhor encaixe | Clientes ricos, IDEs, tarefas longas, streams, contexto por cliente. | Tools simples, API wrappers, cloud/serverless, alto volume horizontal. |

## 7. Quando usar stateful

Use stateful quando o servidor MCP precisa lembrar algo sobre aquele cliente
durante a conexão.

| Cenário real | Por que stateful ajuda |
| --- | --- |
| MCP para IDE/editor | O servidor pode manter contexto do workspace, roots, capabilities e eventos daquele cliente. |
| Tarefas demoradas | O servidor pode enviar progresso e manter uma conexão viva enquanto a tarefa roda. |
| Notificações do servidor para o cliente | O servidor consegue enviar logs, mudanças de recursos, progresso ou eventos via SSE. |
| Fluxos interativos | Elicitation, confirmação do usuário e pedidos de dados adicionais se encaixam melhor com session. |
| Estado temporário por conexão | Preferências, filtros temporários, cache por cliente e contexto de conversa podem ficar ligados a uma session. |
| Cliente MCP rico | Clientes com conexão persistente se beneficiam mais da continuidade do transporte. |
| Experimentos com protocolo MCP completo | Bom para aprender e validar streams, notificações, lifecycle e encerramento de session. |

Exemplo no contexto deste projeto:

```text
O cliente inicia uma "sessão de deck building".
O servidor guarda preferências temporárias, cartas escolhidas,
progresso de validação e envia notificações conforme a análise avança.
```

Esse tipo de fluxo combina com stateful.

## 8. Quando usar stateless

Use stateless quando cada tool pode ser executada sem depender de histórico
local do servidor.

| Cenário real | Por que stateless encaixa |
| --- | --- |
| Tool simples de consulta | `health_check`, `search_card`, `get_card_by_name` e `get_sets` podem responder com base apenas no input. |
| Wrapper de API externa | Se o MCP só chama Scryfall, GitHub, Jira ou outro serviço, cada request pode ser independente. |
| Deploy com múltiplos pods | Qualquer pod pode responder qualquer request. |
| Serverless | Cada invocação cria o necessário, responde e termina. |
| Alto volume de requests curtos | Menos estado local reduz pressão de memória e cleanup. |
| Baixa necessidade de SSE | Respostas HTTP diretas bastam para a maioria dos fluxos. |

Exemplo no contexto deste projeto:

```text
O cliente chama search_cards com uma query Scryfall.
O servidor chama a API externa, formata a resposta e retorna.
Nenhuma memória local é necessária para responder o próximo request.
```

Esse tipo de fluxo combina com stateless.

## 9. Kubernetes, múltiplos pods e Redis

Em Kubernetes, o principal problema do modo stateful é que o `Map` de sessions
fica dentro de um pod específico.

Exemplo:

```text
Pod A
Pod B
Pod C
```

O cliente inicializa no Pod A:

```text
Client -> Pod A
sessionId = abc-123
sessions.set("abc-123", ...)
```

Depois o cliente chama uma tool com:

```text
mcp-session-id: abc-123
```

Mas o load balancer envia o request para o Pod B:

```text
Client -> Pod B
```

O Pod B não tem `abc-123` em memória. Para ele, a session parece inválida.

### 9.1. Redis pode salvar sessions?

Redis pode ajudar, mas ele não deve armazenar a session MCP inteira.

No código atual, a session contém objetos vivos:

```ts
{
  server: McpServer,
  transport: StreamableHTTPServerTransport,
}
```

Esses objetos têm callbacks, streams HTTP/SSE, estado interno do SDK e
referências de runtime. Eles não são serializáveis de forma útil para Redis.

O Redis pode guardar metadados e estado de negócio:

| Dado | Pode ir para Redis? | Exemplo |
| --- | --- | --- |
| `sessionId` | Sim | `abc-123` |
| Dono da session | Sim | `pod-a` |
| Usuário ou tenant | Sim | `user-42` |
| Data de criação | Sim | `createdAt` |
| TTL e expiração | Sim | `expiresIn: 30min` |
| Estado de negócio | Sim | deck atual, preferências, cache |
| Progresso de tarefa longa | Sim | `indexing: 70%` |
| `McpServer` | Não recomendado | Objeto vivo em memória |
| `StreamableHTTPServerTransport` | Não | Conexão, stream e callbacks |

Redis, portanto, pode ser um registro distribuído de sessions, mas não substitui
automaticamente o `transport` que está vivo em um pod.

### 9.2. Arquiteturas possíveis

| Estratégia | Como funciona | Quando usar |
| --- | --- | --- |
| Stateless | Remove a dependência de session MCP. Cada request é independente. | Melhor para tools simples, wrappers de API e escala horizontal. |
| Stateful com sticky session | O ingress/load balancer envia requests do mesmo cliente para o mesmo pod. | Melhor quando você quer manter `StreamableHTTPServerTransport` stateful. |
| Redis como registry | Redis guarda `sessionId -> podId`, TTL e metadados. | Útil para observabilidade, validação, expiração e cleanup distribuído. |
| Redis + Pub/Sub ou Streams | Pods publicam eventos, e o pod dono da session entrega via SSE. | Bom para notificações e tarefas longas distribuídas. |
| Estado de negócio externo | Redis ou banco guarda dados de negócio, e o MCP mantém pouco estado local. | Bom para tolerar restart, rebalance e múltiplos pods. |
| Roteamento por `mcp-session-id` | Uma camada de roteamento envia o request para o pod dono da session. | Útil em arquiteturas avançadas, mas aumenta bastante a complexidade. |

### 9.3. Recomendação para Kubernetes

Para um MCP simples, prefira stateless:

```text
qualquer request -> qualquer pod -> resposta
```

Para um MCP rico, prefira stateful com afinidade:

```text
initialize -> Pod A
requests seguintes com mcp-session-id -> Pod A
Redis -> metadados, TTL, progresso e estado de negócio
```

Redis entra como apoio, não como substituto direto do `transport`.

## 10. Pontos de atenção no código atual

O código atual funciona como base stateful, mas alguns pontos merecem atenção se
o projeto evoluir.

| Ponto | Observação | Possível melhoria |
| --- | --- | --- |
| Erro para session ausente ou inválida | Hoje o handler retorna `400` nos dois casos. | Retornar `400` para session ausente e `404` para session desconhecida pode ajudar clientes a reinicializar. |
| TTL de sessions | Não há expiração explícita. | Adicionar TTL, cleanup periódico, ou expiração via Redis. |
| Crescimento de memória | Cada session mantém `server` e `transport`. | Medir sessões ativas, limitar quantidade e limpar sessions ociosas. |
| Múltiplos pods | O `Map` é local ao processo. | Usar stateless, sticky sessions, ou roteamento por session. |
| Fechamento de recursos | `closeSession()` fecha `transport` e `server`. | Verificar se fechar apenas o `server` já cobre o caso, para simplificar sem duplicidade. |
| Caminhos MCP | O código registra `GET`, `POST`, e `DELETE` em `MCP_MESSAGES_PATH` e `MCP_SSE_PATH`. | Confirmar se o cliente usado espera endpoint único de Streamable HTTP ou caminhos separados. |

## 11. Recomendação para este projeto

No estado atual, o servidor expõe a tool `health_check`. Esse tipo de tool não
precisa lembrar nada entre requests. Se o objetivo principal for simplicidade,
deploy fácil e escala em Kubernetes, stateless é suficiente.

Stateless tende a ser a melhor escolha quando as futuras tools forem consultas
diretas ao Scryfall:

- `search_cards`
- `get_card_by_name`
- `get_card_rules`
- `get_sets`
- `validate_and_analyze_deck`, se a validação for resolvida em uma chamada ou
  em um job externo consultável por ID

Stateful passa a fazer mais sentido se o projeto evoluir para experiências com
continuidade:

- sessão de deck building;
- cache temporário por cliente;
- progresso via SSE;
- notificações server-to-client;
- fluxos interativos com confirmação do usuário;
- tarefas longas que precisam manter stream aberto.

Regra prática:

```text
input -> chama domínio/API -> output
```

Use stateless.

```text
initialize -> manter contexto -> stream/eventos -> múltiplas interações -> cleanup
```

Use stateful.

## 12. Checklist de decisão

Antes de escolher o modo, responda:

- A tool precisa lembrar algo entre requests?
- O servidor precisa enviar mensagens espontâneas para o cliente?
- O cliente precisa manter stream SSE aberto?
- Haverá múltiplos pods respondendo o mesmo endpoint?
- O deploy será serverless?
- O estado pode ser reconstruído a partir do body, auth, banco ou Redis?
- Uma tarefa longa pode ser modelada como job externo com polling?
- O custo de sticky sessions e cleanup de sessions vale o benefício?

Se a maioria das respostas aponta para independência por request, use
stateless. Se a maioria aponta para continuidade de conexão, use stateful.

## 13. Referências

- [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [TypeScript SDK: StreamableHTTPServerTransport options](https://ts.sdk.modelcontextprotocol.io/v2/interfaces/_modelcontextprotocol_server.server_streamableHttp.WebStandardStreamableHTTPServerTransportOptions.html)
- [`src/app.ts`](../src/app.ts)
- [`docs/mcp-mtg-scryfall-tdd.md`](./mcp-mtg-scryfall-tdd.md)
