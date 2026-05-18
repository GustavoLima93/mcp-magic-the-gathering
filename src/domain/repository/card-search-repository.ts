import type {
	SearchCardsRepositoryInput,
	SearchCardsResult,
} from '@/domain/entity/models/card-search';

export interface CardSearchRepository {
	search(input: SearchCardsRepositoryInput): Promise<SearchCardsResult>;
}
