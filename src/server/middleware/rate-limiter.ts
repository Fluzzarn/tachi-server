import { Request } from "express";
import rateLimit, { Options } from "express-rate-limit";
import { RedisClient } from "external/redis/redis";
import { ONE_MINUTE } from "lib/constants/time";
import CreateLogCtx from "lib/logger/logger";
import { Environment, ServerConfig, TachiConfig } from "lib/setup/config";
import RateLimitRedis from "rate-limit-redis";
import { integer } from "tachi-common";
import { OmitUndefinedKeys } from "utils/misc";

const logger = CreateLogCtx(__filename);

function CreateStore(name: string) {
	return Environment.nodeEnv === "production" || Environment.nodeEnv === "staging"
		? new RateLimitRedis({ prefix: `${TachiConfig.NAME}-RL:${name}`, client: RedisClient })
		: undefined; // undefined forces a default to an in-memory store
}

export function ClearTestingRateLimitCache() {
	// ???
	NormalRateLimitMiddleware.resetKey(`::ffff:127.0.0.1`);
	AggressiveRateLimitMiddleware.resetKey(`::ffff:127.0.0.1`);
	HyperAggressiveRateLimitMiddleware.resetKey(`::ffff:127.0.0.1`);
}

const CreateRateLimitOptions = (max: integer, name: string, windowMs?: number): Partial<Options> =>
	OmitUndefinedKeys({
		max,
		onLimitReached: (req: Request) => {
			logger.warn(`User ${req.ip} hit rate limit.`, {
				url: req.url,
				method: req.method,
				hideFromConsole: ["req"],
			});
		},
		store: CreateStore(name),
		message: {
			success: false,
			description: `You have exceeded ${max} requests per ${
				(windowMs ?? 60_000) / 1000
			} seconds. Please wait.`,
			status: 429,
			message: "You're being rate limited.",
		},
		windowMs,
	});

// 100 requests / minute is the current cap
export const NormalRateLimitMiddleware = rateLimit(
	CreateRateLimitOptions(ServerConfig.RATE_LIMIT, "Normal")
);

// 15 requests every 10 minutes.
export const AggressiveRateLimitMiddleware = rateLimit(
	CreateRateLimitOptions(10, "Aggressive", ONE_MINUTE * 10)
);

// 2 requests every 20 minutes.
export const HyperAggressiveRateLimitMiddleware = rateLimit(
	CreateRateLimitOptions(2, "HyAgressive", ONE_MINUTE * 5)
);

// 5 requests every minute. This one has a tighter window, so it is less
// vulnerable to bursting down the server.
export const ScoreImportRateLimiter =
	// if we're in testing, disable this rate limit!
	Environment.nodeEnv === "test"
		? rateLimit(CreateRateLimitOptions(Infinity, "ScImport", ONE_MINUTE))
		: rateLimit(CreateRateLimitOptions(5, "ScImport", ONE_MINUTE));
