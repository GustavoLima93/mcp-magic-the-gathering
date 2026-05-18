import {
	formatSearchCardsResult,
	toSearchCardsUseCaseInput,
} from '@/application/controller/dtos/search-cards-dto';
import { formatSearchCardsError } from '@/application/controller/error/search-cards-error';
import type { SearchCardsToolInput, ToolController } from '@/application/types';
import type { SearchCardsUseCase } from '@/domain/use-case/search-cards-use-case';
import { makeSearchCardsUseCase } from '@/infra/factory/make-search-cards-use-case';

export interface CreateSearchCardsControllerInput {
	searchCardsUseCase: SearchCardsUseCase;
}

export const createSearchCardsController =
	(): ToolController<SearchCardsToolInput> => {
		return async (toolInput) => {
			try {
				const searchCardsUseCase = makeSearchCardsUseCase();
				const result = await searchCardsUseCase.execute(
					toSearchCardsUseCaseInput(toolInput),
				);

				return formatSearchCardsResult(result);
			} catch (error) {
				return formatSearchCardsError(error);
			}
		};
	};
