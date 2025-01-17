/* eslint-disable no-await-in-loop */
import { RequestHandler, Router } from "express";
import p from "prudence";
import { SYMBOL_TachiAPIAuth } from "lib/constants/tachi";
import CreateLogCtx, { ChangeRootLogLevel, GetLogLevel } from "lib/logger/logger";
import prValidate from "server/middleware/prudence-validate";
import { GetUserWithID } from "utils/user";
import { ONE_MINUTE } from "lib/constants/time";
import { ServerConfig, TachiConfig } from "lib/setup/config";
import { Game, UserAuthLevels } from "tachi-common";
import db from "external/mongo/db";
import { DeleteMultipleScores, DeleteScore } from "lib/score-mutation/delete-scores";
import { RecalcAllScores, UpdateAllPBs } from "utils/calculations/recalc-scores";
import DestroyUserGamePlaytypeData from "utils/reset-state/destroy-ugpt";
import { RecalcSessions } from "utils/calculations/recalc-sessions";

const logger = CreateLogCtx(__filename);

const router: Router = Router({ mergeParams: true });

const RequireAdminLevel: RequestHandler = async (req, res, next) => {
	if (!req[SYMBOL_TachiAPIAuth].userID) {
		return res.status(401).json({
			success: false,
			description: `You are not authenticated.`,
		});
	}

	const userDoc = await GetUserWithID(req[SYMBOL_TachiAPIAuth].userID!);

	if (!userDoc) {
		logger.severe(
			`Api Token ${req[SYMBOL_TachiAPIAuth].token} is assigned to ${req[SYMBOL_TachiAPIAuth].userID}, who does not exist?`
		);

		return res.status(500).json({
			success: false,
			description: `An internal error has occured.`,
		});
	}

	if (userDoc.authLevel !== UserAuthLevels.ADMIN) {
		return res.status(403).json({
			success: false,
			description: `You are not authorised to perform this.`,
		});
	}

	return next();
};

const LOG_LEVEL = ServerConfig.LOGGER_CONFIG.LOG_LEVEL;

router.use(RequireAdminLevel);

let currentLogLevelTimer: NodeJS.Timeout | null = null;

/**
 * Changes the current server log level to the provided `logLevel` in the request body.
 *
 * @param logLevel - The log level to change to.
 * @param duration - The amount of minutes to wait before changing the log level back to the default.
 * Defaults to 60 minutes.
 * @param noReset - If true, do not ever reset this decision.
 *
 * @name POST /api/v1/admin/change-log-level
 */
router.post(
	"/change-log-level",
	prValidate({
		logLevel: p.isIn("crit", "severe", "error", "warn", "info", "verbose", "debug"),
		duration: p.optional(p.isPositiveNonZero),
		noReset: p.optional("boolean"),
	}),
	(req, res) => {
		const logLevel = GetLogLevel();
		ChangeRootLogLevel(req.body.logLevel);

		const duration = req.body.duration ?? 60;

		if (currentLogLevelTimer) {
			logger.verbose(`Removing last timer to reset log level to ${LOG_LEVEL}.`);
			clearTimeout(currentLogLevelTimer);
		}

		logger.info(`Log level has been changed to ${req.body.level}.`);

		if (!req.body.noReset) {
			logger.info(`This will reset to "${LOG_LEVEL}" level in ${duration} minutes.`);

			currentLogLevelTimer = setTimeout(() => {
				logger.verbose(`Changing log level back to ${LOG_LEVEL}.`);
				ChangeRootLogLevel(LOG_LEVEL);
				logger.info(`Reset log level back to ${LOG_LEVEL}.`);
			}, duration * ONE_MINUTE);
		}

		return res.status(200).json({
			success: true,
			description: `Changed log level from ${logLevel} to ${req.body.logLevel}.`,
			body: {},
		});
	}
);

/**
 * Resynchronises all PBs that match the given query or users.
 *
 * @param userIDs - Optionally, An array of integers of users to resync.
 * @param filter - Optionally, the set of scores to resync.
 *
 * @name POST /api/v1/admin/resync-pbs
 */
router.post(
	"/resync-pbs",
	prValidate({
		userIDs: p.optional([p.isPositiveInteger]),
		filter: "*object",
	}),
	async (req, res) => {
		await UpdateAllPBs(req.body.userIDs, req.body.filter);

		return res.status(200).json({
			success: true,
			description: `Done.`,
			body: {},
		});
	}
);

/**
 * Force Delete anyones score.
 *
 * @param scoreID - The scoreID to delete.
 *
 * @name POST /api/v1/admin/delete-score
 */
router.post("/delete-score", prValidate({ scoreID: "string" }), async (req, res) => {
	const score = await db.scores.findOne({ scoreID: req.body.scoreID });

	if (!score) {
		return res.status(404).json({
			success: false,
			description: `This score does not exist.`,
		});
	}

	await DeleteScore(score);

	return res.status(200).json({
		success: true,
		description: `Removed score.`,
		body: {},
	});
});

/**
 * Destroys a users UGPT profile and forces a leaderboard recalc.
 *
 * @param userID - The U...
 * @param game - The G...
 * @param playtype - And the PT to delete.
 *
 * @name POST /api/v1/admin/destroy-ugpt
 */
router.post(
	"/destroy-ugpt",
	prValidate({
		userID: p.isInteger,
		game: p.isIn(TachiConfig.GAMES),
		playtype: "string", // lazy
	}),
	async (req, res) => {
		const { userID, game, playtype } = req.body;

		const ugpt = await db["game-stats"].findOne({
			userID,
			game,
			playtype,
		});

		if (!ugpt) {
			return res.status(404).json({
				success: false,
				description: `No stats for ${userID} (${game} ${playtype}) exist.`,
			});
		}

		await DestroyUserGamePlaytypeData(userID, game, playtype);

		return res.status(200).json({
			success: true,
			description: `Completely destroyed UGPT for ${userID} (${game} ${playtype}).`,
			body: {},
		});
	}
);

/**
 * Destroy a chart and all of its scores (and sessions).
 *
 * @param chartID - The chartID to delete.
 * @param game - The game this chart is for. Necessary for doing lookups.
 *
 * @name POST /api/v1/admin/destroy-chart
 */
router.post(
	"/destroy-chart",
	prValidate({ chartID: "string", game: p.isIn(TachiConfig.GAMES) }),
	async (req, res) => {
		const game: Game = req.body.game;
		const chartID: string = req.body.chartID;

		const scores = await db.scores.find({
			chartID,
		});

		await DeleteMultipleScores(scores);

		await db.charts[game].remove({
			chartID,
		});

		await db["personal-bests"].remove({
			chartID,
		});

		return res.status(200).json({
			success: true,
			description: `Obliterated chart.`,
			body: {},
		});
	}
);

/**
 * Perform a site recalc on this set of scores.
 *
 * @name POST /api/v1/admin/recalc
 */
router.post("/recalc", async (req, res) => {
	const filter = req.body ?? {};
	await RecalcAllScores(filter);

	const scoreIDs = (
		await db.scores.find(filter, {
			projection: {
				scoreID: 1,
			},
		})
	).map((e) => e.scoreID);

	await RecalcSessions({
		"scoreInfo.scoreID": { $in: scoreIDs },
	});

	return res.status(200).json({
		success: true,
		description: `Recalced scores.`,
		body: {
			scoresRecalced: scoreIDs.length,
		},
	});
});

export default router;
