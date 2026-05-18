import { SearchCardsUseCase } from '@/domain/use-case/search-cards-use-case';
import { ScryfallHttpClient } from '@/infra/client/scryfall/scryfall-http-client';
import { ScryfallRateLimiter } from '@/infra/client/scryfall/scryfall-rate-limiter';
import { env } from '@/infra/env';
import { ScryfallCardSearchRepository } from '@/infra/repository/scryfall-card-search-repository';

const scryfallRateLimiter = new ScryfallRateLimiter();

export const makeSearchCardsUseCase = (): SearchCardsUseCase => {
	const scryfallHttpClient = new ScryfallHttpClient({
		baseUrl: env.SCRYFALL_API_BASE_URL,
		timeoutMs: env.SCRYFALL_HTTP_TIMEOUT_MS,
	});
	const cardSearchRepository = new ScryfallCardSearchRepository(
		scryfallHttpClient,
		scryfallRateLimiter,
	);

	return new SearchCardsUseCase(cardSearchRepository);
};
