# mcp-server-bootstrap Specification

## Purpose
Define the baseline behavior for the Fastify-based MCP server bootstrap,
including configurable metadata, configurable transport routes, the
protocol-level health tool, and fail-fast environment validation.

## Requirements
### Requirement: MCP server metadata MUST be configurable
The MCP server MUST load metadata from environment variables so that name and version can change per environment without code changes.

#### Scenario: Startup with defaults
- **GIVEN** `MCP_SERVER_NAME` and `MCP_SERVER_VERSION` are not explicitly configured
- **WHEN** the server starts
- **THEN** it MUST use documented default values
- **AND** it MUST expose these values in the MCP server metadata

#### Scenario: Startup with explicit version
- **GIVEN** `MCP_SERVER_VERSION=1.2.3`
- **WHEN** the server starts
- **THEN** the MCP metadata MUST publish version `1.2.3`

### Requirement: MCP transport routes MUST be configurable
The server MUST allow overriding MCP HTTP/SSE routes via environment variables.

#### Scenario: Custom MCP paths
- **GIVEN** custom values for `MCP_MESSAGES_PATH` and `MCP_SSE_PATH`
- **WHEN** the server starts
- **THEN** it MUST bind the MCP transport using those paths

### Requirement: Server MUST expose a protocol-level health tool
The server MUST provide a deterministic tool named `health_check` that reports process health and basic metadata.

#### Scenario: Successful health check call
- **GIVEN** the MCP server is running
- **WHEN** a client calls the tool `health_check`
- **THEN** the response MUST include `status` with value `ok`
- **AND** include `serverName`, `version`, `timestamp`, and `uptimeSeconds`

#### Scenario: Health check is independent from external APIs
- **GIVEN** an external dependency (e.g. Scryfall) is unavailable
- **WHEN** a client calls `health_check`
- **THEN** the server MUST still return local health status successfully

### Requirement: Invalid environment MUST fail fast
The server MUST stop startup when required environment values are malformed.

#### Scenario: Invalid port
- **GIVEN** `PORT=abc`
- **WHEN** startup is attempted
- **THEN** the process MUST fail before accepting requests
- **AND** emit a clear configuration validation error
