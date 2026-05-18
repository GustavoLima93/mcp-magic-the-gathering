# MCP Node

Servidor MCP HTTP para expor ferramentas de Magic: The Gathering a clientes
compatíveis com o Model Context Protocol. A implementação usa Fastify,
TypeScript e a API pública do Scryfall.

## Visão geral

O projeto roda um servidor MCP sobre HTTP/SSE e registra tools que podem ser
chamadas por clientes MCP, como IDEs e assistentes com suporte ao protocolo.

Tools disponíveis:

- `health_check`: retorna metadados do servidor e informações básicas do
  processo local.
- `search_cards`: pesquisa cartas de Magic: The Gathering usando a sintaxe de
  busca fulltext do Scryfall.

## Stack

- Node.js e TypeScript.
- Fastify para a borda HTTP.
- `@modelcontextprotocol/sdk` para o servidor MCP e transporte HTTP.
- Zod para validação de entrada e variáveis de ambiente.
- Pino para logs.
- Scryfall API como fonte de dados de cartas.

## Arquitetura

O código segue arquitetura hexagonal com DDD tático. A direção das dependências
é:

```text
infra -> application -> domain
```

As principais responsabilidades ficam separadas assim:

- `src/domain`: entidades ricas, models, contratos de repository, erros de
  domínio e use cases.
- `src/application`: controllers MCP, DTOs de entrada e saída, formatação de
  respostas e tradução de erros para payloads de tool.
- `src/infra`: Fastify, SDK MCP, env, logging, clients externos, repositories
  concretos, middlewares e factories de composição.

Consulte [AGENTS.md](AGENTS.md) antes de adicionar novas tools ou mover código
entre camadas.

## Pré-requisitos

- Node.js com suporte a `fetch` nativo.
- pnpm `11.1.2`, conforme `devEngines.packageManager`.

## Instalação

Instale as dependências:

```sh
pnpm install
```

Opcional: crie um arquivo `.env` para sobrescrever os valores padrão. Se você
não criar esse arquivo, a aplicação usa os defaults definidos em
`src/infra/env/index.ts`.

## Configuração

As variáveis abaixo são lidas pela camada `src/infra/env`.

| Variável | Default | Descrição |
| --- | --- | --- |
| `NODE_ENV` | `development` | Ambiente de execução. |
| `HOST` | `0.0.0.0` | Host usado pelo Fastify. |
| `PORT` | `3000` | Porta HTTP do servidor. |
| `MCP_SERVER_NAME` | `mcp-node` | Nome publicado no servidor MCP. |
| `MCP_SERVER_VERSION` | `0.1.0` | Versão publicada no servidor MCP. |
| `MCP_MESSAGES_PATH` | `/mcp/messages` | Caminho HTTP para mensagens MCP. |
| `MCP_SSE_PATH` | `/mcp/sse` | Caminho HTTP para SSE. |
| `SCRYFALL_API_BASE_URL` | `https://api.scryfall.com` | Base URL da API Scryfall. |
| `SCRYFALL_HTTP_TIMEOUT_MS` | `10000` | Timeout das chamadas ao Scryfall. |

`MCP_MESSAGES_PATH` e `MCP_SSE_PATH` precisam começar com `/` e não podem ter o
mesmo valor.

## Scripts

Execute em desenvolvimento com recarga automática:

```sh
pnpm start:dev
```

Gere o build de produção:

```sh
pnpm build
```

Inicie o build gerado:

```sh
pnpm start
```

Rode os testes:

```sh
pnpm test
```

## Endpoints MCP

Por padrão, o servidor expõe:

- `GET|POST|DELETE /mcp/messages`
- `GET|POST|DELETE /mcp/sse`

O middleware MCP cria sessões apenas para requests de inicialização válidos e
resolve sessões existentes pelo header `mcp-session-id`.

## Tool `search_cards`

`search_cards` chama `/cards/search` no Scryfall e aplica os defaults de domínio
antes de enviar a requisição externa. A resposta em JSON retorna um payload
compacto em `structuredContent`; a resposta em CSV retorna o CSV no conteúdo de
texto da tool.

Parâmetros:

| Campo | Tipo | Default | Descrição |
| --- | --- | --- | --- |
| `q` | `string` | obrigatório | Query fulltext do Scryfall. |
| `unique` | `cards`, `art`, `prints` | `cards` | Estratégia de agrupamento. |
| `order` | `name`, `set`, `released`, `rarity`, `color`, `usd`, `tix`, `eur`, `cmc`, `power`, `toughness`, `edhrec`, `penny`, `artist`, `review` | `name` | Ordenação dos resultados. |
| `dir` | `auto`, `asc`, `desc` | `auto` | Direção da ordenação. |
| `include_extras` | `boolean` | `false` | Inclui tokens, planes, schemes e extras. |
| `include_multilingual` | `boolean` | `false` | Inclui cartas em outros idiomas. |
| `include_variations` | `boolean` | `false` | Inclui variações raras de cartas. |
| `page` | `number` | `1` | Página de resultados, iniciando em `1`. |
| `format` | `json`, `csv` | `json` | Formato de retorno solicitado ao Scryfall. |
| `pretty` | `boolean` | `false` | Solicita JSON formatado ao Scryfall. |

Exemplo de entrada:

```json
{
  "q": "c:red t:creature cmc<=2",
  "order": "edhrec",
  "dir": "desc"
}
```

## Desenvolvimento

Para adicionar uma nova tool MCP:

1. Modele a regra em `src/domain`.
2. Crie controllers e DTOs em `src/application`.
3. Implemente clients, repositories, schemas HTTP e factories em `src/infra`.
4. Registre a tool por `server.setTool(...)` em `src/infra/http/app.ts`.
5. Rode `pnpm build` e `pnpm test`.

Evite importar Fastify, SDK MCP, env, Pino, clients externos ou repositories
concretos fora da camada de infraestrutura.

## Documentação relacionada

- [Technical Design Document](docs/mcp-mtg-scryfall-tdd.md)
- [MCP stateful e stateless](docs/mcp-stateful-stateless.md)
