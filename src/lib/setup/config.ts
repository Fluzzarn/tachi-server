/* eslint-disable no-console */
// barrel file for re-exporting env variables.
import dotenv from "dotenv";
import fs from "fs";
import JSON5 from "json5";
import { SendMailOptions } from "nodemailer";
import p from "prudence";
import { integer, StaticConfig, Game, ImportTypes } from "tachi-common";
import { FormatPrError } from "utils/prudence";

dotenv.config(); // imports things like NODE_ENV from a local .env file if one is present.

// stub - having a real logger here creates a circular dependency.
const logger = console;

const confLocation = process.env.TCHIS_CONF_LOCATION ?? "./conf.json5";

// reads from $pwd/conf.json5, unless an override is set
let confFile;

try {
	confFile = fs.readFileSync(confLocation, "utf-8");
} catch (err) {
	logger.error("Error while trying to open conf.json5. Is one present?", { err });
	process.exit(1);
}

const config = JSON5.parse(confFile);

function isValidURL(self: unknown) {
	if (typeof self !== "string") {
		return `Expected URL, received type ${typeof self}`;
	}

	try {
		new URL(self);
		return true;
	} catch (err) {
		return `Invalid URL ${self}.`;
	}
}

export interface OAuth2Info {
	CLIENT_ID: string;
	CLIENT_SECRET: string;
	REDIRECT_URI: string;
}

export interface TachiServerConfig {
	MONGO_DATABASE_NAME: string;
	CAPTCHA_SECRET_KEY: string;
	SESSION_SECRET: string;
	FLO_API_URL?: string;
	EAG_API_URL?: string;
	MIN_API_URL?: string;
	ARC_API_URL?: string;
	FLO_OAUTH2_INFO?: OAuth2Info;
	EAG_OAUTH2_INFO?: OAuth2Info;
	MIN_OAUTH2_INFO?: OAuth2Info;
	ARC_AUTH_TOKEN?: string;
	ENABLE_SERVER_HTTPS?: boolean;
	CLIENT_DEV_SERVER?: string | null;
	RATE_LIMIT: integer;
	OAUTH_CLIENT_CAP: integer;
	OPTIONS_ALWAYS_SUCCEEDS?: boolean;
	USE_EXTERNAL_SCORE_IMPORT_WORKER?: boolean;
	EMAIL_CONFIG?: {
		FROM: string;
		DKIM?: SendMailOptions["dkim"];
		// @warning This is explicitly allowed to be any
		// As nodemailer doesnt properly export the types we care about
		// This should be set to SMTPTransport.Options, but it is
		// inaccessible.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		TRANSPORT_OPS: any;
	};
	USC_QUEUE_SIZE: integer;
	BEATORAJA_QUEUE_SIZE: integer;
	OUR_URL: string;
	INVITE_CODE_CONFIG?: {
		BATCH_SIZE: integer;
		INVITE_CAP: integer;
		BETA_USER_BONUS: integer;
	};
	TACHI_CONFIG: {
		NAME: string;
		TYPE: "ktchi" | "btchi" | "omni";
		GAMES: Game[];
		IMPORT_TYPES: ImportTypes[];
	};
	LOGGER_CONFIG: {
		LOG_LEVEL: "debug" | "verbose" | "info" | "warn" | "error" | "severe" | "crit";
		CONSOLE: boolean;
		FILE: boolean;
		SEQ_API_KEY: string | undefined;
		DISCORD?: {
			WEBHOOK_URL: string;
			WHO_TO_TAG: string[];
		};
	};
	CDN_CONFIG: {
		WEB_LOCATION: string;
		SAVE_LOCATION:
			| { TYPE: "LOCAL_FILESYSTEM"; LOCATION: string; SERVE_OWN_CDN?: boolean }
			| {
					TYPE: "S3_BUCKET";
					ENDPOINT: string;
					ACCESS_KEY_ID: string;
					SECRET_ACCESS_KEY: string;
					BUCKET: string;
					KEY_PREFIX?: string;
					REGION?: string;
			  };
	};
}

const isValidOauth2 = p.optional({
	CLIENT_ID: "string",
	CLIENT_SECRET: "string",
	REDIRECT_URI: "string",
});

const err = p(config, {
	MONGO_DATABASE_NAME: "string",
	CAPTCHA_SECRET_KEY: "string",
	SESSION_SECRET: "string",
	FLO_API_URL: p.optional(isValidURL),
	EAG_API_URL: p.optional(isValidURL),
	MIN_API_URL: p.optional(isValidURL),
	ARC_API_URL: p.optional(isValidURL),
	FLO_OAUTH2_INFO: isValidOauth2,
	EAG_OAUTH2_INFO: isValidOauth2,
	MIN_OAUTH2_INFO: isValidOauth2,
	ARC_AUTH_TOKEN: "*string",
	ENABLE_SERVER_HTTPS: "*boolean",
	CLIENT_DEV_SERVER: "*?string",
	RATE_LIMIT: p.optional(p.isPositiveInteger),
	OAUTH_CLIENT_CAP: p.optional(p.isPositiveInteger),
	OPTIONS_ALWAYS_SUCCEEDS: "*boolean",
	USE_EXTERNAL_SCORE_IMPORT_WORKER: "*boolean",
	EMAIL_CONFIG: p.optional({
		FROM: "string",
		DKIM: "*object",
		// WARN: This validation is improper and lazy.
		// The actual content is just some wacky options object.
		// I'm not going to assert this properly.
		TRANSPORT_OPS: "*object",
	}),
	USC_QUEUE_SIZE: p.optional(p.gteInt(2)),
	BEATORAJA_QUEUE_SIZE: p.optional(p.gteInt(2)),
	OUR_URL: "string",
	INVITE_CODE_CONFIG: p.optional({
		BATCH_SIZE: p.isPositiveInteger,
		INVITE_CAP: p.isPositiveInteger,
		BETA_USER_BONUS: p.isPositiveInteger,
	}),
	TACHI_CONFIG: {
		NAME: "string",
		TYPE: p.isIn("ktchi", "btchi", "omni"),
		GAMES: [p.isIn(StaticConfig.allSupportedGames)],
		IMPORT_TYPES: [p.isIn(StaticConfig.allImportTypes)],
	},
	LOGGER_CONFIG: p.optional({
		LOG_LEVEL: p.optional(
			p.isIn("debug", "verbose", "info", "warn", "error", "severe", "crit")
		),
		CONSOLE: "*boolean",
		FILE: "*boolean",
		SEQ_API_KEY: "*string",
		DISCORD: p.optional({
			WEBHOOK_URL: "string",
			WHO_TO_TAG: ["string"],
		}),
	}),
	CDN_CONFIG: {
		WEB_LOCATION: "string",
		SAVE_LOCATION: p.or(
			{
				TYPE: p.is("LOCAL_FILESYSTEM"),
				SERVE_OWN_CDN: "*boolean",
				LOCATION: "string",
			},
			{
				TYPE: p.is("S3_BUCKET"),
				ENDPOINT: "string",
				ACCESS_KEY_ID: "string",
				SECRET_ACCESS_KEY: "string",
				BUCKET: "string",
				KEY_PREFIX: "*string",
				REGION: "*string",
			}
		),
	},
});

if (err) {
	throw FormatPrError(err, "Invalid conf.json5 file.");
}

const tachiServerConfig = config as TachiServerConfig;

// default rate limit 500
tachiServerConfig.RATE_LIMIT ??= 500;
tachiServerConfig.OAUTH_CLIENT_CAP ??= 15;
tachiServerConfig.USC_QUEUE_SIZE ??= 3;
tachiServerConfig.BEATORAJA_QUEUE_SIZE ??= 3;

// Assign sane defaults to the logger config.
tachiServerConfig.LOGGER_CONFIG = Object.assign(
	{
		LOG_LEVEL: "info",
		CONSOLE: true,
		FILE: true,
	},
	tachiServerConfig.LOGGER_CONFIG ?? {}
);

export const TachiConfig = tachiServerConfig.TACHI_CONFIG;
export const ServerConfig = tachiServerConfig;

// Environment Variable Validation

let port = Number(process.env.PORT);
if (Number.isNaN(port) && process.env.IS_SERVER) {
	logger.warn(`No/invalid PORT specified in environment, defaulting to 8080.`);
	port = 8080;
}

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
	logger.error(`No REDIS_URL specified in environment. Terminating.`);
	process.exit(1);
}

const mongoUrl = process.env.MONGO_URL;
if (!mongoUrl) {
	logger.error(`No MONGO_URL specified in environment. Terminating.`);
	process.exit(1);
}

const seqUrl = process.env.SEQ_URL;
if (!seqUrl && tachiServerConfig.LOGGER_CONFIG.SEQ_API_KEY) {
	logger.warn(
		`No SEQ_URL specified in environment, yet LOGGER_CONFIG.SEQ_API_KEY was defined. No logs will be sent to Seq!`
	);
}

const nodeEnv = process.env.NODE_ENV;
if (!nodeEnv) {
	logger.error(`No NODE_ENV specified in environment. Terminating.`);
	process.exit(1);
}

if (!["dev", "production", "staging", "test"].includes(nodeEnv)) {
	logger.error(
		`Invalid NODE_ENV set in environment. Expected dev, production, test or staging. Got ${nodeEnv}.`
	);
	process.exit(1);
}

const replicaIdentity = process.env.REPLICA_IDENTITY;

export const Environment = {
	port,
	redisUrl,
	mongoUrl,
	nodeEnv,
	replicaIdentity,
	seqUrl,
};
