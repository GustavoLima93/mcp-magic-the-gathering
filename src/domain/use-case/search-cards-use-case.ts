import { CardSearch } from '@/domain/entity/card-search';
import type {
	SearchCardsResult,
	SearchCardsUseCaseInput,
} from '@/domain/entity/models/card-search';
import type { CardSearchRepository } from '@/domain/repository/card-search-repository';

export class SearchCardsUseCase {
	constructor(private readonly cardSearchRepository: CardSearchRepository) {}

	public async execute(
		input: SearchCardsUseCaseInput,
	): Promise<SearchCardsResult> {
		const cardSearch = new CardSearch(input);

		return this.cardSearchRepository.search(cardSearch.toRepositoryInput());
	}
}
