import connectRedis from "connect-redis";
import express, { Express } from "express";
import "express-async-errors";
import expressSession from "express-session";
import { RedisClient } from "external/redis/redis";
import helmet from "helmet";
import { SYMBOL_TachiAPIAuth } from "lib/constants/tachi";
import CreateLogCtx from "lib/logger/logger";
import { Environment, ServerConfig, TachiConfig } from "lib/setup/config";
import { integer } from "tachi-common";
import { RequestLoggerMiddleware } from "./middleware/request-logger";
import mainRouter from "./router/router";

const logger = CreateLogCtx(__filename);

let store;

if (Environment.nodeEnv !== "test") {
	logger.info("Connecting ExpressSession to Redis.", { bootInfo: true });
	const RedisStore = connectRedis(expressSession);
	store = new RedisStore({
		host: "localhost",
		port: 6379,
		client: RedisClient,
		prefix: TachiConfig.NAME,
	});
}

const userSessionMiddleware = expressSession({
	// append node_env onto the end of the session name
	// so we can separate tokens under the same URL.
	// say for staging.kamaitachi.xyz
	name: `${TachiConfig.NAME.replace(/ /gu, "_")}_SESSION`,
	secret: ServerConfig.SESSION_SECRET,
	store,
	resave: true,
	saveUninitialized: false,
	cookie: {
		secure: Environment.nodeEnv === "production" || ServerConfig.ENABLE_SERVER_HTTPS,
		sameSite: "strict", // Very important. Without this, we're vulnerable to CSRF!
	},
});

const app: Express = express();

if (Environment.nodeEnv !== "production" && ServerConfig.CLIENT_DEV_SERVER) {
	logger.warn(`Enabling CORS requests from ${ServerConfig.CLIENT_DEV_SERVER}.`, {
		bootInfo: true,
	});

	// Allow CORS requests from another server (since we have our dev server hosted separately).
	app.use((req, res, next) => {
		res.header("Access-Control-Allow-Origin", ServerConfig.CLIENT_DEV_SERVER!);
		res.header(
			"Access-Control-Allow-Headers",
			"Origin, X-Requested-With, Content-Type, Accept, X-User-Intent"
		);
		res.header("Access-Control-Allow-Credentials", "true");
		res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
		next();
	});

	// hack to allow all OPTIONS requests. Remember that this setting should not be on in production!
	if (ServerConfig.OPTIONS_ALWAYS_SUCCEEDS) {
		app.options("*", (req, res) => res.send());
	}
} else {
	if (Environment.nodeEnv !== "test") {
		logger.info("Enabling Helmet, as no CLIENT_DEV_SERVER was set, or we are in production.", {
			bootInfo: true,
		});
	}
	app.use(helmet());
}

app.use(userSessionMiddleware);

// Most of these options are leveraged from KTAPI

// Pass the IP of the user up our increasingly insane chain of nginx/docker nonsense
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

// we don't allow nesting in query strings.
app.set("query parser", "simple");

// taken from https://nodejs.org/api/process.html#process_event_unhandledrejection
// to avoid future deprecation.
process.on("unhandledRejection", (reason, promise) => {
	// @ts-expect-error reason is an error, and the logger can handle errors
	// it just refuses.
	logger.error(reason, { promise });
});

// enable reading json bodies
// limit them so as not to choke the api
app.use(express.json({ limit: "4mb" }));

app.use((req, res, next) => {
	// Always mount an empty req body. We operate under the assumption that req.body is
	// always defined.
	if (req.method !== "GET" && !req.body) {
		req.body = {};
	}

	return next();
});

app.use(RequestLoggerMiddleware);

app.use("/", mainRouter);

// The SERVE_OWN_CDN option means that our /cdn path has to be hosted by us. In production,
// this is not the case (we have a dedicated nginx box for it running in a separate process).
// In dev, this is a pain to setup, so we can just run it locally.
if (
	ServerConfig.CDN_CONFIG.SAVE_LOCATION.TYPE === "LOCAL_FILESYSTEM" &&
	ServerConfig.CDN_CONFIG.SAVE_LOCATION.SERVE_OWN_CDN
) {
	if (Environment.nodeEnv === "production") {
		logger.warn(
			`Running LOCAL_FILESYSTEM OWN_CDN in production. Consider making a separate process handle your CDN for performance.`,
			{ bootInfo: true }
		);
	}

	logger.info(`Running own CDN at ${ServerConfig.CDN_CONFIG.SAVE_LOCATION.LOCATION}.`, {
		bootInfo: true,
	});

	app.use("/cdn", express.static(ServerConfig.CDN_CONFIG.SAVE_LOCATION.LOCATION));
	app.get("/cdn/*", (req, res) => res.status(404).send("No content here."));
}

// completely stolen from ktapi error handler
interface ExpressJSONErr extends SyntaxError {
	status: integer;
	message: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAIN_ERR_HANDLER: express.ErrorRequestHandler = (err, req, res, next) => {
	if (err instanceof SyntaxError) {
		const expErr: ExpressJSONErr = err as ExpressJSONErr;
		if (expErr.status === 400 && "body" in expErr) {
			logger.info(`JSON Parsing Error?`, {
				url: req.originalUrl,
				userID: req[SYMBOL_TachiAPIAuth]?.userID,
			});
			return res.status(400).send({ success: false, description: err.message });
		}

		// else, this isn't a JSON parsing error
	}

	if (err.type === "entity.too.large") {
		return res.status(413).json({
			success: false,
			description: "Your request body was too large. The limit is 4MB.",
		});
	}

	logger.error("Fatal error propagated to server root? ", { err, route: req.route });
	return res.status(500).json({
		success: false,
		description: "A fatal internal server error has occured.",
	});
};

app.use(MAIN_ERR_HANDLER);

export default app;
