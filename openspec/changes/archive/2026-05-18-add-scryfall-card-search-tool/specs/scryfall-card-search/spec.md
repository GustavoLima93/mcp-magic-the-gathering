## ADDED Requirements

### Requirement: MCP server MUST expose a Scryfall card search tool
The MCP server MUST expose a tool named `search_cards` that searches Magic: The Gathering cards through Scryfall `GET /cards/search`.

#### Scenario: Tool is registered
- **WHEN** the MCP server starts
- **THEN** the server MUST register a tool named `search_cards`
- **AND** the tool description MUST identify that it searches Scryfall cards using fulltext search syntax

#### Scenario: Valid search query is executed
- **GIVEN** a client calls `search_cards` with `q` set to `c:red pow=3`
- **WHEN** the tool handles the request
- **THEN** it MUST execute a Scryfall card search for that query
- **AND** it MUST return a List-compatible response to the MCP client

### Requirement: Search input MUST support documented Scryfall search options
The `search_cards` tool MUST accept the Scryfall card search parameters required for fulltext search, rollup, sorting, inclusion flags, pagination, and response format.

#### Scenario: Default options are applied
- **GIVEN** a client calls `search_cards` with only a valid `q`
- **WHEN** the tool builds the Scryfall request
- **THEN** it MUST default `unique` to `cards`
- **AND** it MUST default `order` to `name`
- **AND** it MUST default `dir` to `auto`
- **AND** it MUST default `include_extras`, `include_multilingual`, and `include_variations` to `false`
- **AND** it MUST default `page` to `1`
- **AND** it MUST default `format` to `json`

#### Scenario: Optional options are passed to Scryfall
- **GIVEN** a client calls `search_cards` with valid optional values for `unique`, `order`, `dir`, `include_extras`, `include_multilingual`, `include_variations`, `page`, `format`, or `pretty`
- **WHEN** the tool builds the Scryfall request
- **THEN** it MUST include those values as encoded query parameters for Scryfall

#### Scenario: Query is URL encoded
- **GIVEN** a client calls `search_cards` with `q` containing spaces, colons, comparison operators, or Unicode characters
- **WHEN** the infrastructure adapter builds the Scryfall request URL
- **THEN** it MUST encode the query with URL-safe query parameter encoding

### Requirement: Search input MUST be validated
The `search_cards` tool MUST reject invalid input before calling Scryfall.

#### Scenario: Missing query is rejected
- **GIVEN** a client calls `search_cards` without `q`
- **WHEN** the tool handles the request
- **THEN** it MUST return an MCP error response
- **AND** it MUST NOT call Scryfall

#### Scenario: Blank query is rejected
- **GIVEN** a client calls `search_cards` with `q` containing only whitespace
- **WHEN** the tool handles the request
- **THEN** it MUST return an MCP error response
- **AND** it MUST NOT call Scryfall

#### Scenario: Overlong query is rejected
- **GIVEN** a client calls `search_cards` with `q` longer than 1000 Unicode characters
- **WHEN** the tool handles the request
- **THEN** it MUST return an MCP error response
- **AND** it MUST NOT call Scryfall

#### Scenario: Invalid enum option is rejected
- **GIVEN** a client calls `search_cards` with an unsupported `unique`, `order`, `dir`, or `format` value
- **WHEN** the tool handles the request
- **THEN** it MUST return an MCP error response
- **AND** it MUST NOT call Scryfall

#### Scenario: Invalid page is rejected
- **GIVEN** a client calls `search_cards` with `page` lower than `1` or with a non-integer value
- **WHEN** the tool handles the request
- **THEN** it MUST return an MCP error response
- **AND** it MUST NOT call Scryfall

### Requirement: JSON search responses MUST return compact card results
For JSON searches, the `search_cards` tool MUST return compact structured content that preserves List metadata while omitting unnecessary raw Scryfall payload fields.

#### Scenario: Multiple cards are returned
- **GIVEN** Scryfall returns a JSON List containing multiple cards
- **WHEN** the tool returns the MCP response
- **THEN** `structuredContent` MUST include `object` with value `list`
- **AND** it MUST include `totalCards`, `hasMore`, and `data`
- **AND** each item in `data` MUST be a simplified card object suitable for LLM context

#### Scenario: One card is returned as a list
- **GIVEN** Scryfall returns a JSON List containing exactly one card
- **WHEN** the tool returns the MCP response
- **THEN** it MUST still return a List-compatible result
- **AND** it MUST NOT collapse the response into a single card object

#### Scenario: Pagination metadata is preserved
- **GIVEN** Scryfall returns `has_more` with value `true` and a `next_page` URL
- **WHEN** the tool returns the MCP response
- **THEN** `structuredContent` MUST include `hasMore` with value `true`
- **AND** it MUST include `nextPage` with the Scryfall next page URL

### Requirement: CSV search responses MUST be supported as text
The `search_cards` tool MUST support Scryfall CSV output without attempting to parse CSV into simplified card objects.

#### Scenario: CSV format is requested
- **GIVEN** a client calls `search_cards` with `format` set to `csv`
- **WHEN** Scryfall returns a successful CSV response
- **THEN** the MCP response `content` MUST include the CSV text
- **AND** the response MUST identify the format as `csv`

#### Scenario: CSV response does not include JSON card data
- **GIVEN** a client calls `search_cards` with `format` set to `csv`
- **WHEN** the tool returns the MCP response
- **THEN** it MUST NOT claim that `structuredContent.data` contains parsed card objects

### Requirement: Scryfall calls MUST be rate limited
The infrastructure adapter for Scryfall card search MUST limit outbound Scryfall requests to no more than 2 requests per second in the current process.

#### Scenario: Sequential searches are spaced
- **GIVEN** two `search_cards` calls are made back-to-back in the same process
- **WHEN** both calls reach the Scryfall infrastructure adapter
- **THEN** the adapter MUST start the second Scryfall HTTP request at least 500ms after the first request start

### Requirement: Scryfall failures MUST become MCP tool errors
The `search_cards` tool MUST translate Scryfall API errors, network failures, and invalid upstream payloads into MCP error responses.

#### Scenario: Scryfall returns an Error object
- **GIVEN** Scryfall returns a non-2xx response with an Error object
- **WHEN** the tool handles the response
- **THEN** it MUST return an MCP response with `isError` set to `true`
- **AND** it MUST include a useful error message from Scryfall when available

#### Scenario: Scryfall network request fails
- **GIVEN** the outbound request to Scryfall fails before a response is received
- **WHEN** the tool handles the failure
- **THEN** it MUST return an MCP response with `isError` set to `true`
- **AND** it MUST include a generic Scryfall availability error

#### Scenario: Scryfall payload is malformed
- **GIVEN** Scryfall returns a successful response that does not match the expected JSON List shape for `format=json`
- **WHEN** the tool handles the response
- **THEN** it MUST return an MCP response with `isError` set to `true`
- **AND** it MUST include a generic upstream payload error
