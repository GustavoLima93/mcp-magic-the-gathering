# Technical Design Document (TDD): Servidor MCP Magic: The Gathering

## 1. Contexto e Objetivo
O objetivo deste projeto é desenvolver um servidor no padrão **MCP (Model Context Protocol)** que forneça ferramentas e dados sobre o jogo Magic: The Gathering para modelos de linguagem (LLMs). Ao invés de uma interface de linha de comando (`stdio`), o servidor utilizará o protocolo **HTTP com Server-Sent Events (SSE)**.

A fonte de dados original seria o pacote `mtg-sdk-typescript`, porém, devido à sua depreciação, o projeto adotará a **Scryfall API**, que é o padrão atual da comunidade por oferecer dados rápidos, ricos (imagens, legalidade, preços, rulings) e endpoints de listagem otimizados.

## 2. Arquitetura

O servidor adotará a stack baseada em **Node.js** + **Fastify**, aproveitando a alta performance do Fastify e o seu suporte robusto a streams, que é essencial para as conexões SSE exigidas pela comunicação remota do MCP.

### 2.1. Topologia de Comunicação
O cliente MCP (ex: Claude Desktop, Cursor) conectará ao nosso servidor via HTTP, que servirá de ponte (API Gateway / Adapter) para a API pública do Scryfall.

```text
┌──────────────┐                                    ┌────────────────────────┐
│              │       HTTP POST /mcp/messages      │  Fastify MCP Server    │
│  MCP Client  │ ─────────────────────────────────▶ │                        │
│    (LLM)     │                                    │  (Controllers/Domain)  │
│              │       HTTP GET /mcp/sse (Stream)   │                        │
│              │ ◀───────────────────────────────── │                        │
└──────────────┘                                    └──────────┬─────────────┘
                                                               │ HTTP GET/POST
                                                               ▼
                                                    ┌────────────────────────┐
                                                    │    Scryfall API        │
                                                    │ (api.scryfall.com)     │
                                                    └────────────────────────┘
```

## 3. Ferramentas (Tools) do MCP

O servidor irá expor as seguintes ferramentas para que a LLM possa construir o contexto desejado:

### 3.1. `search_cards`
- **Descrição**: Realiza buscas avançadas na base de cartas utilizando a sintaxe nativa do Scryfall.
- **Entrada (Parâmetros)**: `{ "query": "string" }` (Ex: `"c:red t:goblin cmc<3"`).
- **Ação**: Faz uma chamada GET para `https://api.scryfall.com/cards/search?q={query}`.
- **Saída**: Um objeto de paginação contendo a lista simplificada de cartas (Nome, Custo de Mana, Linha de Tipo, Texto Oracle, Legalidade).

### 3.2. `get_card_rules`
- **Descrição**: Traz decisões oficiais de juízes (rulings) de uma carta, ideal para tirar dúvidas de regras durante uma partida.
- **Entrada (Parâmetros)**: `{ "card_name": "string" }` ou `{ "card_id": "string" }`.
- **Ação**: Busca a carta exata em `/cards/named` e em seguida bate no endpoint associado de `/rulings`.
- **Saída**: Uma matriz com datas e os textos explicativos das regras aplicadas àquela carta.

### 3.3. `get_sets`
- **Descrição**: Retorna todas as edições, coleções e expansões de Magic registradas no sistema.
- **Entrada (Parâmetros)**: Nenhum, ou filtro simplificado de tipo (ex: `expansion`).
- **Ação**: Chamada HTTP para `https://api.scryfall.com/sets`.
- **Saída**: Uma lista de sets contendo o código (ex: `woe` para Wilds of Eldraine), nome por extenso e número de cartas.

### 3.4. `validate_and_analyze_deck` (Construtor e Validador)
- **Descrição**: Recebe uma compilação em lote de cartas solicitadas pela LLM, envia para validação no banco de dados estruturado do Scryfall e retorna as estatísticas precisas daquelas cartas. Isso transfere a carga de processamento estatístico para a API, deixando a LLM livre para gerar a "análise descritiva" ("explicação de como usar o baralho").
- **Entrada (Parâmetros)**: `{ "cards_list": ["Lightning Bolt", "Goblin Guide", ...] }`.
- **Ação**: Mapeia as cartas e executa um `POST /cards/collection` para baixar os metadados de até 75 cartas por request em lote.
- **Saída**: O MCP retornará um JSON contendo a matriz de todas as cartas com as legalidades de format (`legalities`), custo em CMC puro e a associação de core-tags (cores, se é artefato/criatura, etc).

## 4. Estrutura de Diretórios e Domínio

O projeto seguirá o boilerplate arquitetural DDD e arquitetura hexagonal mapeado no `AGENTS.md`:

- **`src/domain/`**: Nenhuma importação HTTP ou SDK. Conterá Entidades como `Card`, `Deck`, `Set` e as portas (Interfaces) para a busca.
- **`src/application/`**: Casos de uso do servidor MCP, como `SearchCardsUseCase`, contendo DTOs que mapaeiam a entrada da LLM para a chamada no Scryfall. Os Handlers do Endpoint (`/mcp/*`) ficarão na sub-pasta `application/controller/`.
- **`src/infra/`**:
  - `http/`: Implementação do Fastify, roteamento e SSE.
  - `client/ScryfallClient.ts`: O Axios ou fetch configurado puro fazendo a comunicação HTTPS restrita para as URLs listadas na especificação.

## 5. Cuidados Técnicos e Limitações

- **Rate Limits (Scryfall)**: A API do Scryfall pede para não ultrapassarmos o limite ético de 10 requests por segundo (`10 req/s`). Na camada de `infra/client`, deveremos implementar um leve `delay` ou usar uma biblioteca como `bottleneck` para não tomarmos *status 429 Too Many Requests*.
- **SSE Headers**: O framework Fastify precisará emitir o header `Content-Type: text/event-stream` com controle correto da persistência de conexão (`res.flush()` ou equivalente).
- **Volume de Resposta em Lista**: Por limitação de contexto nas LLMs, ferramentas que voltam muitas cartas (ex: `search_cards`) deverão formatar seus resultados, omitindo atributos pesados do JSON de `Card` do Scryfall (removeremos os arrays de ilustrações e URIs gigantes) antes de enviar para o cliente MCP.