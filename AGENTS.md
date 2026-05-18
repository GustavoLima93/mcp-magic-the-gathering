## Arquitetura

Este projeto segue uma arquitetura hexagonal com DDD tático. A estrutura
principal é organizada em três camadas: domínio, application e infraestrutura.

### Domínio

Objetivo: concentrar regras de negócio, entidades, value objects e contratos,
totalmente independente de frameworks e bibliotecas. Código puro em TypeScript.

Diretrizes:
- Nenhuma dependência de infraestrutura, web, banco, HTTP, SDKs, libs de
  terceiros ou frameworks.
- Entidades ricas ficam em `src/domain/entity` e devem concentrar construtor,
  normalização, validações, invariantes e comportamentos do domínio. Não trate
  entidades como POJOs, DTOs ou simples value objects: uma entidade rica pode
  ter métodos como `sacar`, `depositar`, `transferir`, `ativar`,
  `cancelar`, `aprovar` ou qualquer operação que expresse uma regra real do
  domínio.
- `src/domain/entity/models` deve conter apenas tipos, interfaces e contratos
  usados pelas entidades ricas e pelos use cases. Não coloque classes, erros ou
  regras de validação nessa pasta.
- Use cases devem utilizar as entidades ricas do domínio em vez de montar
  objetos crus e repetir validações de entidade. Quando uma regra pertence ao
  comportamento natural da entidade, coloque essa regra na entidade e deixe o
  use case apenas orquestrar a operação.
- Erros de domínio ficam em `src/domain/use-case/error`, separados dos models,
  para serem reutilizados por entidades, use cases, controllers e adapters.
- Use cases recebem dependências por construtor e dependem apenas de contratos
  do domínio. Eles não instanciam clientes HTTP, repositories concretos,
  loggers, SDKs, env ou factories de infraestrutura.
- Factories de composição concreta não ficam no domínio. Novas factories de use
  cases devem ficar na camada de infraestrutura, porque elas conhecem clients,
  repositories concretos, env, rate limiters e outros detalhes operacionais.
- Modelos de domínio, contratos, entidades ricas, erros de domínio e use cases
  ficam aqui.
- Use cases de domínio devem expor regras e payloads sem conhecer MCP, Fastify
  ou Pino.

Pastas atuais relacionadas:
- `src/domain`
- `src/domain/entity`
- `src/domain/entity/models`
- `src/domain/use-case`
- `src/domain/use-case/error`
- `src/domain/repository`

### Application

Objetivo: orquestrar casos de uso e adaptar entradas e saídas para a borda da
aplicação. A camada application depende do domínio, mas não de infraestrutura
concreta.

Diretrizes:
- Controllers de tools MCP ficam em `src/application/controller`.
- Controllers adaptam a entrada recebida da tool, recebem o use case já
  composto pela infraestrutura, executam o caso de uso e formatam a resposta
  esperada pelas tools.
- Conversões entre payload de tool e entrada de use case, além da formatação de
  respostas de sucesso das tools, ficam em `src/application/controller/dtos`.
- Formatação de erros de controller e tradução de exceções para payloads de
  erro das tools ficam em `src/application/controller/error`.
- Tipos compartilhados de entrada e saída da camada ficam em
  `src/application/types`.
- Não inicializar Fastify, transports MCP, logger concreto, env, clients
  externos, repositories concretos ou factories de infraestrutura nesta camada.

Pastas atuais relacionadas:
- `src/application`
- `src/application/controller`
- `src/application/controller/dtos`
- `src/application/controller/error`
- `src/application/types`

### Infraestrutura

Objetivo: concentrar todo código que depende de frameworks, SDKs e bibliotecas.
Implementa adaptadores concretos para HTTP, MCP, configuração, logging,
clientes externos e outros detalhes operacionais.

Diretrizes:
- Implementa as interfaces e contratos definidos no domínio ou application.
- Contém detalhes de framework, SDKs, clients, configs, middlewares e logs.
- É a única camada que deve conhecer Fastify, SDK MCP, dotenv, Zod de env e
  Pino.
- Contém as factories de use cases, pois factories são pontos de composição
  concreta e podem conhecer env, clients externos, adapters, repositories,
  rate limiters e demais dependências operacionais.
- Registra controllers application como tools MCP injetando use cases prontos,
  sem espalhar `new ClienteHttp()`, `new Repository()` ou acesso a env dentro
  de controllers e use cases.

Pastas atuais e recomendadas:
- `src/infra`
- `src/infra/client`
- `src/infra/env`
- `src/infra/factory`
- `src/infra/http`
- `src/infra/http/middleware`
- `src/infra/http/request`
- `src/infra/log`
- `src/infra/repository`

#### `src/infra/http/server.ts`

Responsável por agrupar a configuração do servidor MCP.

Responsabilidades:
- Criar o `McpServer` usando `MCP_SERVER_NAME` e `MCP_SERVER_VERSION`.
- Gerenciar sessões MCP em memória.
- Criar e conectar `StreamableHTTPServerTransport`.
- Fechar sessões, transports e server resources com log de falhas.
- Expor `setTool` como ponto único para registro de tools no MCP server.
- Exportar `isInitializeRequest` para o middleware HTTP validar o fluxo MCP.

Novas tools devem ser registradas por meio do `server.setTool(...)`, de
preferência em `src/infra/http/app.ts` ou em um módulo de composição da camada
infra.

#### `src/infra/http/app.ts`

Responsável pela configuração do framework web Fastify e pela composição da
entrada HTTP da aplicação.

Responsabilidades:
- Criar a instância Fastify com o logger Pino da aplicação.
- Registrar schemas de request vindos de `src/infra/http/request`.
- Registrar controllers application como tools MCP, usando factories da camada
  infra para compor os use cases e suas dependências concretas.
- Registrar rotas Fastify para `MCP_MESSAGES_PATH` e `MCP_SSE_PATH`.
- Delegar o processamento MCP para middlewares da pasta
  `src/infra/http/middleware`.
- Fechar sessões MCP no hook `onClose` do Fastify.

#### `src/infra/factory`

Concentra a composição concreta dos casos de uso.

Responsabilidades:
- Criar clients externos, repositories concretos, rate limiters e outros
  adapters de infraestrutura.
- Ler configurações por meio de `src/infra/env`.
- Montar use cases do domínio injetando apenas os contratos necessários.
- Entregar use cases prontos para a composição HTTP/MCP em `src/infra/http/app.ts`.
- Evitar que controllers application, entidades e use cases importem classes
  concretas de infraestrutura.

Use este padrão para novas factories:

```ts
export const makeMinhaToolUseCase = (): MinhaToolUseCase => {
	const httpClient = new MinhaApiHttpClient({
		baseUrl: env.MINHA_API_BASE_URL,
		timeoutMs: env.MINHA_API_TIMEOUT_MS,
	});
	const repository = new MinhaToolRepository(httpClient);

	return new MinhaToolUseCase(repository);
};
```

Não crie novas factories em `src/domain/use-case/factory`. Se existir código
legado nessa pasta, trate como dívida de migração para a camada infra.

#### `src/infra/http/request`

Concentra validações de entrada da borda HTTP/MCP.

Responsabilidades:
- Declarar schemas Zod usados no registro das tools MCP.
- Traduzir regras de formato da entrada externa, como nomes snake_case e
  restrições aceitas pela tool.
- Reutilizar constantes e tipos do domínio quando necessário para manter os
  valores aceitos alinhados às entidades ricas.
- Não executar use cases, criar controllers, inicializar Fastify ou acessar
  clientes externos.

#### `src/infra/http/middleware`

Concentra middlewares e handlers de borda do Fastify.

Responsabilidades:
- Interpretar requests HTTP do Fastify.
- Resolver sessão MCP por header `mcp-session-id`.
- Criar transport session apenas para requests MCP de inicialização.
- Encaminhar requests válidos ao transport MCP.
- Traduzir falhas de borda para respostas HTTP e logs de infraestrutura.

#### `src/infra/log`

Concentra o logger da aplicação.

Responsabilidades:
- Criar e exportar a instância Pino usada por Fastify, startup e infraestrutura.
- Exportar o tipo `Logger` quando a injeção explícita for necessária.

### Entradas principais

Arquivos de bootstrap e composição ficam em:
- `src/startup.ts`: inicia o servidor HTTP com `host` e `port` vindos de
  `src/infra/env`.
- `src/infra/http/app.ts`: configura Fastify, rotas MCP e registro de tools.
- `src/infra/http/server.ts`: configura o servidor MCP, transports e sessões.

### Como implementar uma nova tool MCP

Use este fluxo para qualquer nova tool. A ordem é sempre:

1. `domain`: define o que a tool faz como regra de negócio.
2. `application`: adapta input e output da tool para o caso de uso.
3. `infra`: expõe a tool no MCP/Fastify e integra dependências concretas.

#### 1. Crie os models do domínio

Crie um arquivo em `src/domain/entity/models`, usando o nome da feature:

```txt
src/domain/entity/models/minha-tool.ts
```

Esse arquivo contém apenas tipos, interfaces e contratos de dados. Não coloque
classes, erros, validações, SDKs, Zod, HTTP ou regras de negócio aqui.

Defina, quando fizer sentido:

- O input bruto aceito pelo use case.
- O input já normalizado que será entregue a um repository.
- O resultado de domínio que será retornado pelo use case.
- Tipos auxiliares usados pela entidade, use case ou repository.

Exemplo:

```ts
export interface MinhaToolUseCaseInput {
	campo?: string;
	incluirDetalhes?: boolean;
}

export interface MinhaToolRepositoryInput {
	campo: string;
	incluirDetalhes: boolean;
}

export interface MinhaToolResult extends Record<string, unknown> {
	campo: string;
	incluirDetalhes: boolean;
}
```

#### 2. Crie a entidade rica do domínio

Crie a entidade em `src/domain/entity`:

```txt
src/domain/entity/minha-tool.ts
```

A entidade recebe o input do use case, normaliza dados, aplica defaults,
protege invariantes e expõe comportamentos do domínio. Ela não deve ser apenas
um objeto com propriedades públicas. Também não deve ser confundida com um DTO
ou um value object.

Use a entidade para concentrar regras como:

- Campo obrigatório.
- Limite máximo de tamanho.
- Valor permitido dentro de uma lista fechada.
- Número inteiro positivo.
- Transição de status permitida.
- Operação que muda estado do domínio.

Exemplo de entidade para uma tool simples:

```ts
export class MinhaTool {
	private readonly campo: string;
	private readonly incluirDetalhes: boolean;

	constructor(input: MinhaToolUseCaseInput) {
		this.campo = this.validateCampo(input.campo);
		this.incluirDetalhes = input.incluirDetalhes ?? false;
	}

	public toRepositoryInput(): MinhaToolRepositoryInput {
		return {
			campo: this.campo,
			incluirDetalhes: this.incluirDetalhes,
		};
	}

	private validateCampo(value: unknown): string {
		if (typeof value !== 'string') {
			throw new MinhaToolValidationError('Campo é obrigatório.');
		}

		const trimmedValue = value.trim();

		if (!trimmedValue) {
			throw new MinhaToolValidationError('Campo não pode ser vazio.');
		}

		return trimmedValue;
	}
}
```

Exemplo conceitual mais claro de entidade rica:

```ts
export class ContaBancaria {
	private saldoEmCentavos: number;

	constructor(
		private readonly id: string,
		saldoInicialEmCentavos: number,
	) {
		this.validateValorNaoNegativo(saldoInicialEmCentavos);
		this.saldoEmCentavos = saldoInicialEmCentavos;
	}

	public depositar(valorEmCentavos: number): void {
		this.validateValorPositivo(valorEmCentavos);
		this.saldoEmCentavos += valorEmCentavos;
	}

	public sacar(valorEmCentavos: number): void {
		this.validateValorPositivo(valorEmCentavos);

		if (valorEmCentavos > this.saldoEmCentavos) {
			throw new ContaBancariaSaldoInsuficienteError();
		}

		this.saldoEmCentavos -= valorEmCentavos;
	}

	public transferir(
		destino: ContaBancaria,
		valorEmCentavos: number,
	): void {
		this.sacar(valorEmCentavos);
		destino.depositar(valorEmCentavos);
	}

	public toSnapshot(): ContaBancariaSnapshot {
		return {
			id: this.id,
			saldoEmCentavos: this.saldoEmCentavos,
		};
	}

	private validateValorPositivo(valorEmCentavos: number): void {
		if (!Number.isInteger(valorEmCentavos) || valorEmCentavos <= 0) {
			throw new ContaBancariaValorInvalidoError();
		}
	}

	private validateValorNaoNegativo(valorEmCentavos: number): void {
		if (!Number.isInteger(valorEmCentavos) || valorEmCentavos < 0) {
			throw new ContaBancariaValorInvalidoError();
		}
	}
}
```

Nesse exemplo, o use case não recalcula a regra de saldo, não manipula o saldo
diretamente e não duplica validações. Ele apenas busca as entidades, chama o
comportamento de domínio e persiste o resultado:

```ts
export class TransferirEntreContasUseCase {
	constructor(private readonly repository: ContaBancariaRepository) {}

	public async execute(input: TransferirEntreContasInput): Promise<void> {
		const origem = await this.repository.findById(input.origemId);
		const destino = await this.repository.findById(input.destinoId);

		origem.transferir(destino, input.valorEmCentavos);

		await this.repository.save(origem);
		await this.repository.save(destino);
	}
}
```

#### 3. Crie os erros de domínio

Crie um arquivo em `src/domain/use-case/error`:

```txt
src/domain/use-case/error/minha-tool-error.ts
```

Crie um erro base da feature e erros específicos. Esses erros podem ser
lançados por entidades, use cases ou adapters de infraestrutura, mas continuam
representando falhas conhecidas do domínio da feature.

Exemplo:

```ts
export type MinhaToolErrorCode =
	| 'MINHA_TOOL_VALIDATION_ERROR'
	| 'MINHA_TOOL_UPSTREAM_ERROR'
	| 'MINHA_TOOL_UNAVAILABLE'
	| 'MINHA_TOOL_MALFORMED_PAYLOAD';

export class MinhaToolError extends Error {
	public readonly code: MinhaToolErrorCode;

	constructor(message: string, code: MinhaToolErrorCode) {
		super(message);
		this.name = new.target.name;
		this.code = code;
	}
}

export class MinhaToolValidationError extends MinhaToolError {
	constructor(message: string) {
		super(message, 'MINHA_TOOL_VALIDATION_ERROR');
	}
}
```

#### 4. Crie um contrato de repository quando houver dependência externa

Se a tool buscar dados em API externa, banco, arquivo, cache ou qualquer
adaptador concreto, crie uma interface no domínio:

```txt
src/domain/repository/minha-tool-repository.ts
```

Exemplo:

```ts
export interface MinhaToolRepository {
	executar(input: MinhaToolRepositoryInput): Promise<MinhaToolResult>;
}
```

O domínio conhece apenas esse contrato. A implementação concreta fica em
`src/infra/repository`.

#### 5. Crie o use case

Crie o caso de uso em `src/domain/use-case`:

```txt
src/domain/use-case/minha-tool-use-case.ts
```

O use case deve ser fino. Ele cria ou recupera entidades ricas, chama métodos
dessas entidades e coordena repositories por meio de contratos.

Exemplo:

```ts
export class MinhaToolUseCase {
	constructor(private readonly repository: MinhaToolRepository) {}

	public async execute(
		input: MinhaToolUseCaseInput,
	): Promise<MinhaToolResult> {
		const entity = new MinhaTool(input);

		return this.repository.executar(entity.toRepositoryInput());
	}
}
```

Não instancie clients, repositories concretos, env, loggers ou SDKs no use
case. Use construtor para receber contratos.

#### 6. Crie a factory do use case na infra

Crie a factory em `src/infra/factory`:

```txt
src/infra/factory/make-minha-tool-use-case.ts
```

A factory conhece detalhes concretos. Ela pode importar `env`, clients,
repositories de infra, rate limiters e o use case do domínio.

Exemplo:

```ts
import { MinhaToolUseCase } from '@/domain/use-case/minha-tool-use-case';
import { MinhaApiHttpClient } from '@/infra/client/minha-api/minha-api-http-client';
import { env } from '@/infra/env';
import { MinhaToolRepository } from '@/infra/repository/minha-tool-repository';

export const makeMinhaToolUseCase = (): MinhaToolUseCase => {
	const httpClient = new MinhaApiHttpClient({
		baseUrl: env.MINHA_API_BASE_URL,
		timeoutMs: env.MINHA_API_TIMEOUT_MS,
	});
	const repository = new MinhaToolRepository(httpClient);

	return new MinhaToolUseCase(repository);
};
```

Essa factory substitui o padrão antigo de colocar composição em
`src/domain/use-case/factory`. Para novas tools, não crie factories dentro de
`domain`.

#### 7. Declare o input da tool na application

Edite `src/application/types/index.ts` e adicione a interface do input que chega
pela tool MCP.

Use os nomes externos da tool. Se a entrada MCP usa `snake_case`, mantenha
`snake_case` nessa interface. O domínio deve receber `camelCase`.

Exemplo:

```ts
export interface MinhaToolInput {
	campo: string;
	incluir_detalhes?: boolean | undefined;
}
```

#### 8. Crie os DTOs da controller

Crie um arquivo em `src/application/controller/dtos`:

```txt
src/application/controller/dtos/minha-tool-dto.ts
```

Esse arquivo converte input da tool para input do use case e formata respostas
de sucesso para o contrato esperado pelas tools MCP.

Exemplo:

```ts
export const toMinhaToolUseCaseInput = (
	toolInput: MinhaToolInput,
): MinhaToolUseCaseInput => {
	return {
		campo: toolInput.campo,
		incluirDetalhes: toolInput.incluir_detalhes,
	};
};

export const formatMinhaToolResult = (
	result: MinhaToolResult,
): ToolControllerResult => {
	return {
		structuredContent: result,
		content: [
			{
				type: 'text',
				text: JSON.stringify(result),
			},
		],
	};
};
```

Se o conteúdo principal for texto puro, como CSV ou Markdown, coloque
metadados em `structuredContent` e o texto final em `content`.

#### 9. Crie o formatter de erro da controller

Crie um arquivo em `src/application/controller/error`:

```txt
src/application/controller/error/minha-tool-error.ts
```

Esse arquivo traduz exceções conhecidas em payloads de erro da tool. Não vaze
stack trace, erro bruto de SDK, erro bruto de HTTP ou detalhes internos.

Exemplo:

```ts
export const formatMinhaToolError = (
	error: unknown,
): ToolControllerResult => {
	const payload = errorToPayload(error);

	return {
		isError: true,
		structuredContent: payload,
		content: [
			{
				type: 'text',
				text: String(payload.error),
			},
		],
	};
};
```

#### 10. Crie a controller da tool

Crie a controller em `src/application/controller`:

```txt
src/application/controller/minha-tool-controller.ts
```

A controller recebe o use case por injeção. Ela não importa factory de infra,
client externo, repository concreto, env, Fastify ou SDK MCP.

Exemplo:

```ts
export interface CreateMinhaToolControllerInput {
	minhaToolUseCase: MinhaToolUseCase;
}

export const createMinhaToolController = (
	input: CreateMinhaToolControllerInput,
): ToolController<MinhaToolInput> => {
	return async (toolInput) => {
		try {
			const result = await input.minhaToolUseCase.execute(
				toMinhaToolUseCaseInput(toolInput),
			);

			return formatMinhaToolResult(result);
		} catch (error) {
			return formatMinhaToolError(error);
		}
	};
};
```

#### 11. Crie o schema Zod da tool na infra

Crie o schema em `src/infra/http/request`:

```txt
src/infra/http/request/minha-tool-input.ts
```

Esse schema representa a borda HTTP/MCP. Use Zod, nomes `snake_case`, limites
aceitos pela tool e descrições com `.describe(...)`.

Exemplo:

```ts
export const minhaToolInputSchema = {
	campo: z.string().trim().min(1).max(1000).describe('Campo de busca.'),
	incluir_detalhes: z
		.boolean()
		.optional()
		.describe('Inclui detalhes adicionais no resultado.'),
} as const;
```

Quando existir uma lista de valores permitidos no domínio, exporte a constante
pela entidade rica e reutilize no schema Zod. Isso mantém domínio e borda MCP
alinhados.

#### 12. Implemente clients e repositories concretos na infra

Se a tool acessa um serviço externo, coloque o client em `src/infra/client`:

```txt
src/infra/client/minha-api/minha-api-http-client.ts
```

O client pode conhecer `fetch`, headers, timeout, SDKs, API externa e formato
bruto da resposta.

Depois implemente o repository concreto em `src/infra/repository`:

```txt
src/infra/repository/minha-tool-repository.ts
```

O repository concreto implementa o contrato do domínio, chama o client externo,
converte o payload externo para modelos do domínio e traduz erros técnicos para
erros conhecidos da feature.

Exemplo:

```ts
export class MinhaToolRepository implements MinhaToolRepositoryPort {
	constructor(private readonly httpClient: MinhaApiHttpClientPort) {}

	public async executar(
		input: MinhaToolRepositoryInput,
	): Promise<MinhaToolResult> {
		try {
			const response = await this.httpClient.get(input);

			return this.toResult(response.body);
		} catch (error) {
			if (error instanceof MinhaApiHttpRequestError) {
				throw new MinhaToolUnavailableError();
			}

			throw error;
		}
	}
}
```

#### 13. Adicione env quando necessário

Se a tool precisa de configuração, edite `src/infra/env/index.ts`.

Exemplo:

```ts
MINHA_API_BASE_URL: z.url().trim().default('https://example.com'),
MINHA_API_TIMEOUT_MS: z.coerce.number().int().min(1).default(10000),
```

Não leia `process.env` diretamente em domínio, application, controller, use
case, entidade ou repository de domínio.

#### 14. Registre a tool no MCP server

Edite `src/infra/http/app.ts`.

Crie o use case pela factory de infra, injete-o na controller e registre a tool
com `server.setTool(...)`.

Exemplo de tool com input:

```ts
const minhaToolUseCase = makeMinhaToolUseCase();

server.setTool(
	'minha_tool',
	'Descrição objetiva do que a tool faz.',
	minhaToolInputSchema,
	createMinhaToolController({ minhaToolUseCase }),
);
```

Exemplo de tool sem input:

```ts
server.setTool(
	'health_check',
	'Returns local process health and MCP server metadata.',
	createHealthCheckController({
		serverName: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	}),
);
```

Não registre tools diretamente no SDK MCP fora de `src/infra/http/server.ts`.
Use sempre `server.setTool(...)`.

#### 15. Valide a implementação

Depois de criar ou alterar uma tool, rode:

```sh
pnpm build
pnpm test
```

Se a mudança tocar documentação OpenSpec, consulte o estado da change antes de
editar arquivos em `openspec/` e finalize com validação strict.

#### Checklist de arquivos para uma nova tool

Uma tool com dependência externa normalmente cria ou altera:

- `src/domain/entity/models/minha-tool.ts`
- `src/domain/entity/minha-tool.ts`
- `src/domain/use-case/error/minha-tool-error.ts`
- `src/domain/repository/minha-tool-repository.ts`
- `src/domain/use-case/minha-tool-use-case.ts`
- `src/infra/factory/make-minha-tool-use-case.ts`
- `src/application/types/index.ts`
- `src/application/controller/minha-tool-controller.ts`
- `src/application/controller/dtos/minha-tool-dto.ts`
- `src/application/controller/error/minha-tool-error.ts`
- `src/infra/http/request/minha-tool-input.ts`
- `src/infra/client/minha-api/minha-api-http-client.ts`
- `src/infra/repository/minha-tool-repository.ts`
- `src/infra/env/index.ts`
- `src/infra/http/app.ts`

Uma tool sem dependência externa pode não precisar de repository, client, env
ou factory complexa. Mesmo assim, mantenha a direção das dependências:
`infra -> application -> domain`.

### OpenSpec

Antes de alterar arquivos em `openspec/`, use o OpenSpec CLI para consultar o
estado da change.

Comandos úteis:
- `pnpm exec openspec list --json`
- `pnpm exec openspec status --change setup-fastify-mcp-server --json`
- `pnpm exec openspec instructions apply --change setup-fastify-mcp-server --json`
- `pnpm exec openspec validate --all --strict --json`

Se o shell do agente não encontrar `pnpm` ou `node`, use o PATH da instalação
NVM local:

```sh
env PATH=/Users/ghlima/.nvm/versions/node/v24.15.0/bin:/Users/ghlima/Library/pnpm:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin pnpm exec openspec validate --all --strict --json
```

Observação: a versão atual do CLI expõe `validate` para validação. Não há
comando `openspec verify` disponível neste ambiente.
