export const SCRYFALL_MIN_REQUEST_INTERVAL_MS = 500;

export interface ScryfallRateLimiterOptions {
	minTimeMs?: number;
	now?: () => number;
	sleep?: (milliseconds: number) => Promise<void>;
}

export interface ScryfallRateLimiterPort {
	waitTurn(): Promise<void>;
}

const defaultSleep = (milliseconds: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
};

export class ScryfallRateLimiter implements ScryfallRateLimiterPort {
	private readonly minTimeMs: number;
	private readonly now: () => number;
	private readonly sleep: (milliseconds: number) => Promise<void>;
	private lastStartedAt: number | undefined;
	private queue = Promise.resolve();

	constructor(options: ScryfallRateLimiterOptions = {}) {
		this.minTimeMs = options.minTimeMs ?? SCRYFALL_MIN_REQUEST_INTERVAL_MS;
		this.now = options.now ?? Date.now;
		this.sleep = options.sleep ?? defaultSleep;
	}

	public async waitTurn(): Promise<void> {
		const previous = this.queue;
		let releaseCurrentTurn = (): void => {};

		this.queue = new Promise<void>((resolve) => {
			releaseCurrentTurn = resolve;
		});

		await previous;

		try {
			if (this.lastStartedAt !== undefined) {
				const elapsedMs = this.now() - this.lastStartedAt;
				const waitMs = Math.max(0, this.minTimeMs - elapsedMs);

				if (waitMs > 0) {
					await this.sleep(waitMs);
				}
			}

			this.lastStartedAt = this.now();
		} finally {
			releaseCurrentTurn();
		}
	}
}
