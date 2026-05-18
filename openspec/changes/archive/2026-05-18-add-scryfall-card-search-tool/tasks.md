## 1. Domain Contract and Use Case

- [x] 1.1 Create card search domain models for query input, supported option unions, compact card output, JSON list output, CSV output, and domain-facing errors.
- [x] 1.2 Add `src/domain/repository/card-search-repository.ts` with a `CardSearchRepository` interface that exposes a search method independent from HTTP and Scryfall infrastructure.
- [x] 1.3 Implement `SearchCardsUseCase` under `src/domain/use-case/` with default option handling, query trimming, 1000 Unicode character validation, page validation, and repository delegation.
- [x] 1.4 Add focused verification for use case success and validation paths using the project's available TypeScript test/build approach.

## 2. Application Controller

- [x] 2.1 Add shared application input/output types for the `search_cards` tool when useful, without importing Fastify, MCP transport, env, logger, or fetch.
- [x] 2.2 Implement `createSearchCardsController` under `src/application/controller/` to call `SearchCardsUseCase` and format JSON results as MCP `structuredContent` plus text content.
- [x] 2.3 Handle CSV results in the controller by returning CSV text content and minimal format metadata without claiming parsed card data.
- [x] 2.4 Translate validation, upstream, and unexpected errors into MCP tool responses with `isError: true`.

## 3. Scryfall Infrastructure

- [x] 3.1 Extend `src/infra/env/index.ts` with `SCRYFALL_API_BASE_URL` and `SCRYFALL_HTTP_TIMEOUT_MS` defaults and fail-fast validation.
- [x] 3.2 Create a Scryfall HTTP client using Node's native `fetch`, `URL`, `URLSearchParams`, `AbortController`, and JSON/CSV response decoding.
- [x] 3.3 Implement a lightweight in-memory Scryfall rate limiter that spaces outbound request starts by at least 500ms.
- [x] 3.4 Implement a concrete Scryfall card search repository in infrastructure that maps domain input to `GET /cards/search` parameters and maps JSON List responses to compact domain output.
- [x] 3.5 Map Scryfall Error objects, network failures, timeouts, and malformed JSON List payloads to domain-facing repository errors.

## 4. Composition and MCP Registration

- [x] 4.1 Add an infrastructure factory that creates the Scryfall HTTP client, concrete card search repository, and `SearchCardsUseCase`.
- [x] 4.2 Define the MCP input schema for `search_cards` using the existing `server.setTool(...)` schema path and supported Scryfall options.
- [x] 4.3 Register `search_cards` through the existing MCP server wrapper from `src/infra/http/app.ts` or a nearby infrastructure composition module.
- [x] 4.4 Ensure the tool description documents Scryfall fulltext syntax and the JSON/CSV format behavior.

## 5. Verification

- [x] 5.1 Verify URL encoding and query parameter defaults for `q`, `unique`, `order`, `dir`, inclusion flags, `page`, `format`, and `pretty`.
- [x] 5.2 Verify JSON mapping keeps List semantics for one or many cards and preserves `totalCards`, `hasMore`, `nextPage`, and compact card data.
- [x] 5.3 Verify CSV format returns text content and does not expose parsed card data in `structuredContent.data`.
- [x] 5.4 Verify rate limiting behavior for two back-to-back repository calls.
- [x] 5.5 Run `pnpm run build` and `pnpm exec openspec validate --all --strict --json` with the local NVM/pnpm PATH when needed.
