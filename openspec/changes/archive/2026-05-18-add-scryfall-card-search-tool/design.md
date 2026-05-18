## Context

The project already has a Fastify-based MCP bootstrap with a `health_check` tool registered through `server.setTool(...)` in the infrastructure HTTP composition layer. The codebase follows hexagonal architecture with tactical DDD: domain code is pure TypeScript, application controllers adapt use cases to MCP tool responses, and infrastructure owns framework, SDK, configuration, logging, HTTP clients, and external API details.

This change adds the first Scryfall-backed data tool from `docs/mcp-mtg-scryfall-tdd.md`: `search_cards`. The tool uses Scryfall `GET /cards/search`, which accepts a fulltext query, pagination, rollup, sort, inclusion flags, and JSON/CSV output. Scryfall calls must be treated as an outbound dependency behind a repository port, and the concrete implementation must use Node's native `fetch` rather than Axios.

## Goals / Non-Goals

**Goals:**
- Expose an MCP tool named `search_cards` for Scryfall fulltext card search.
- Keep the search use case independent from MCP, Fastify, fetch, Pino, env, and Scryfall HTTP details.
- Define a domain repository contract under `src/domain/repository/` and inject a concrete Scryfall implementation through a factory.
- Configure an infrastructure Scryfall HTTP client around Node's native `fetch`.
- Apply the requested 2 requests/second external rate limit with at least 500ms spacing between Scryfall HTTP calls.
- Return compact JSON results for MCP clients by default, preserving pagination metadata and simplified card fields useful to LLMs.
- Support CSV as an explicit format option, returning CSV as text content instead of attempting to force it into the simplified JSON card model.

**Non-Goals:**
- Do not add Axios or any other HTTP client dependency.
- Do not implement other Scryfall tools such as `get_card_rules`, `get_sets`, or deck validation.
- Do not cache search responses in this change.
- Do not duplicate Scryfall's website-only search conveniences such as automatic retries with extras, multilingual expansion, redirects, spelling correction, suggestions, or swizzled price results.
- Do not make the domain layer import Zod, MCP SDK types, Fastify types, Pino, env, or fetch.

## Decisions

### Use Node native fetch in an infrastructure Scryfall client

Create an infrastructure client, for example `src/infra/scryfall/scryfall-http-client.ts`, that owns:
- `baseUrl`, read from `SCRYFALL_API_BASE_URL` with default `https://api.scryfall.com`.
- `timeoutMs`, read from `SCRYFALL_HTTP_TIMEOUT_MS` with a conservative default such as `10000`.
- URL construction and query string encoding via `URL` and `URLSearchParams`.
- `Accept` headers for `application/json` or `text/csv`.
- `fetch` invocation and response decoding.
- timeout support through `AbortController`.

Rationale: Node already provides `fetch`, so Axios would add a dependency without improving this narrow GET integration. Keeping fetch inside infrastructure preserves the domain/application boundaries.

Alternative considered: calling `fetch` directly from the repository. This is simpler initially, but a small client centralizes base URL, timeout, response decoding, and future Scryfall endpoints without leaking HTTP mechanics into every adapter.

### Model Scryfall as a domain repository port

Add a domain repository contract such as `src/domain/repository/card-search-repository.ts`:

```ts
export interface CardSearchRepository {
	search(input: SearchCardsRepositoryInput): Promise<SearchCardsRepositoryResult>;
}
```

The use case depends only on this interface. The concrete adapter, for example `ScryfallCardSearchRepository`, lives in infrastructure and maps domain input to Scryfall `/cards/search` query parameters.

Rationale: the HTTP call is an outbound data source for the use case. Treating it as a repository keeps Scryfall replaceable and testable through dependency inversion.

Alternative considered: putting Scryfall calls in the use case. This would be faster to code but would violate the project architecture and make the domain depend on infrastructure.

### Keep validation split by boundary

The MCP registration layer should define the tool input schema using the SDK-compatible schema support already exposed by `server.setTool(...)`. The use case should still enforce domain-relevant guards:
- `q` is required after trimming.
- `q` must be at most 1000 Unicode characters.
- `page` must be a positive integer when provided.
- enum options must be within Scryfall-supported values if they reach the use case.

Rationale: schema validation gives clients fast feedback at the edge, while domain guards prevent invalid use case execution in tests or future non-MCP callers.

Alternative considered: only validating in MCP input schema. This leaves the use case too trusting and harder to reuse safely.

### Return compact JSON by default and CSV as text

For `format=json` or omitted `format`, the repository decodes Scryfall's List response and maps each card to a compact domain model with fields such as:
- `id`
- `name`
- `manaCost`
- `typeLine`
- `oracleText`
- `colors`
- `colorIdentity`
- `legalities`
- `releasedAt`
- `set`
- `setName`
- `collectorNumber`
- `rarity`
- `scryfallUri`
- `imageUris`

The result also preserves list metadata:
- `totalCards`
- `hasMore`
- `nextPage`
- `page`
- `warnings` when useful

For `format=csv`, the repository returns the CSV body as text with metadata available from the request context. The controller places the CSV in MCP `content` and may keep minimal `structuredContent` such as `format`, `query`, and `page`.

Rationale: MCP clients benefit from structured JSON for normal tool use, while CSV support remains available without inventing a lossy CSV-to-card parser.

Alternative considered: always returning raw Scryfall card JSON. This exposes large image and URI payloads that the TDD explicitly asks us to avoid for LLM context efficiency.

### Add a factory in infrastructure composition

Create a factory such as `src/infra/factory/make-search-cards-use-case.ts`:

```ts
export function makeSearchCardsUseCase() {
	const scryfallHttpClient = new ScryfallHttpClient();
	const cardSearchRepository = new ScryfallCardSearchRepository(scryfallHttpClient);

	return new SearchCardsUseCase(cardSearchRepository);
}
```

The application controller receives the use case instance:

```ts
createSearchCardsController({
	searchCardsUseCase: makeSearchCardsUseCase(),
});
```

Rationale: this mirrors the requested factory pattern while keeping concrete infrastructure dependencies out of domain and application use case code. Since the factory imports infrastructure adapters, it belongs in infrastructure or a composition module.

Alternative considered: instantiating the repository directly in `app.ts`. That is acceptable for tiny apps, but a factory keeps `app.ts` focused on MCP/Fastify composition and makes future tests simpler.

### Register the tool through the existing MCP server wrapper

Register `search_cards` through `server.setTool(...)`, preferably from `src/infra/http/app.ts` or a nearby infrastructure composition module. The controller should return the current `ToolControllerResult` shape:
- `structuredContent` for JSON searches.
- `content` with a JSON string for JSON searches or CSV text for CSV searches.
- `isError: true` for validation or Scryfall failures.

Rationale: `server.setTool(...)` is already the single MCP registration point documented in `AGENTS.md`.

Alternative considered: extending `Server` with Scryfall-specific registration. That would couple the MCP server wrapper to one tool and make new tools harder to compose.

### Implement rate limiting in the Scryfall infrastructure adapter

Add a lightweight in-memory throttle shared by Scryfall client calls so requests are serialized with at least 500ms between starts. The repository/client should await the throttle before calling fetch.

Rationale: the requested limit is 2 requests/second. Keeping this in infrastructure treats it as an external system constraint, not a business rule.

Alternative considered: adding a dependency such as Bottleneck. The current need is small enough that a local queue/timestamp throttle is easier to audit and avoids dependency churn.

## Risks / Trade-offs

- Scryfall outages or non-2xx responses -> Map Scryfall Error objects to a clear MCP error response with `isError: true`, status/code details when available, and no thrown framework-specific error escaping the controller.
- Large JSON result pages can still contain up to 175 cards -> Return simplified cards only and avoid raw Scryfall payloads in MCP structured content.
- CSV responses are less ergonomic for MCP clients -> Keep JSON as the default and document CSV as pass-through text.
- In-memory rate limiting is process-local -> Accept for the current single-node server; revisit distributed rate limiting only if multiple processes are deployed.
- Scryfall `next_page` contains an absolute API URL -> Preserve it as metadata but continue using explicit input parameters for subsequent tool calls instead of trusting arbitrary URLs.
- Domain validation and edge schema can drift -> Define shared TypeScript union types for allowed values in the domain and mirror them in the MCP input schema tests.

## Migration Plan

1. Add the new domain repository contract, card search models, and use case.
2. Add the application controller for `search_cards`.
3. Add Scryfall environment configuration with defaults for base URL and timeout.
4. Add the infrastructure Scryfall fetch client, rate limiter, concrete repository, and factory.
5. Register the tool through `server.setTool(...)`.
6. Add focused tests or build checks for use case validation, repository URL construction/response mapping, controller formatting, and registration.
7. Deploy with existing server startup flow; rollback by removing the `search_cards` registration and associated implementation files.
