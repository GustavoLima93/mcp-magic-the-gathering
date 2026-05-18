## Why

The MCP server needs a first real Magic: The Gathering data tool that can search Scryfall cards using the same fulltext syntax expected by users and LLM clients. Adding `search_cards` now builds on the completed Fastify/MCP bootstrap and follows the Scryfall direction documented in `docs/mcp-mtg-scryfall-tdd.md`.

## What Changes

- Add a new MCP tool capability named `search_cards` for `GET /cards/search`.
- Support Scryfall search parameters for query, rollup strategy, ordering, direction, inclusion flags, pagination, and response format selection where appropriate.
- Introduce a domain-level repository contract for card search so the use case remains independent from HTTP, Node fetch, and Scryfall-specific infrastructure.
- Add an infrastructure Scryfall HTTP client using Node's native `fetch`, configured without Axios.
- Implement a concrete Scryfall card repository with request encoding, response parsing, and rate limit protection for 2 requests per second.
- Add an application controller that calls the card search use case and formats the MCP tool response.
- Add a factory/composition function that injects the Scryfall repository into the use case before registering the tool.

## Capabilities

### New Capabilities
- `scryfall-card-search`: Defines MCP card search behavior backed by Scryfall `GET /cards/search`, including query validation, supported options, pagination metadata, and error behavior.

### Modified Capabilities

None.

## Impact

- Affected domain code: repository contract, card search use case payloads, and simplified card/result models.
- Affected application code: controller and shared input/output types for the `search_cards` tool.
- Affected infrastructure code: Scryfall fetch client configuration, concrete repository, rate limiting, factory/composition, and MCP tool registration.
- External system: Scryfall API `https://api.scryfall.com/cards/search`.
- Dependencies: no Axios or new HTTP client dependency is required; implementation should use Node's built-in `fetch`.
