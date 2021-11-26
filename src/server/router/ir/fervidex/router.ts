import { RequestHandler, Router } from "express";
import db from "external/mongo/db";
import {
	EXT_BISTROVER,
	EXT_HEROIC_VERSE,
	MODEL_INFINITAS_2,
	REV_2DXBMS,
} from "lib/constants/ea3id";
import { SYMBOL_TachiAPIAuth } from "lib/constants/tachi";
import CreateLogCtx from "lib/logger/logger";
import { ExpressWrappedScoreImportMain } from "lib/score-import/framework/express-wrapper";
import { RequirePermissions } from "server/middleware/auth";
import { integer, Playtypes } from "tachi-common";
import { UpdateClassIfGreater } from "utils/class";
import { ParseEA3SoftID } from "utils/ea3id";

const logger = CreateLogCtx(__filename);

const router: Router = Router({ mergeParams: true });

const ValidateFervidexHeader: RequestHandler = (req, res, next) => {
	const agent = req.header("User-Agent");

	if (!agent) {
		logger.debug(
			`Rejected fervidex client with no agent from user ${req[SYMBOL_TachiAPIAuth].userID!}.`
		);
		return res.status(400).json({
			success: false,
			error: `Invalid User-Agent.`,
		});
	}

	if (!agent.startsWith("fervidex/")) {
		logger.info(
			`Rejected fervidex client with invalid agent ${agent} from user ${req[
				SYMBOL_TachiAPIAuth
			].userID!}.`
		);
		return res.status(400).json({
			success: false,
			error: `Invalid User-Agent ${agent} - expected fervidex client.`,
		});
	}

	const versions = agent.split("fervidex/")[1].split(".").map(Number);

	if (!versions.every((e) => !Number.isNaN(e))) {
		logger.info(
			`Rejected fervidex client with agent ${agent} for NaN-like versions from user ${req[
				SYMBOL_TachiAPIAuth
			].userID!}.`
		);
		return res.status(400).json({
			success: false,
			error: `Invalid version ${versions.join(".")}.`,
		});
	}

	// version.minor
	if (versions[1] < 3) {
		logger.debug(
			`Rejected outdated fervidex client from user ${req[SYMBOL_TachiAPIAuth].userID!}.`
		);
		return res.status(400).json({
			success: false,
			error: `Versions of fervidex < 1.3.0 are not supported.`,
		});
	}

	return next();
};

const RequireInf2ModelHeaderOrForceStatic: RequestHandler = async (req, res, next) => {
	const settings = await db["fer-settings"].findOne({ userID: req[SYMBOL_TachiAPIAuth].userID! });

	if (settings && settings.forceStaticImport) {
		logger.debug(`User ${settings.userID} had forceStaticImport set, allowing request.`);
		return next();
	}

	const swModel = req.header("X-Software-Model");

	if (!swModel) {
		logger.debug(
			`Rejected empty X-Software-Model from user ${req[SYMBOL_TachiAPIAuth].userID!}.`
		);
		return res.status(400).json({
			success: false,
			error: `Invalid X-Software-Model.`,
		});
	}

	try {
		ParseEA3SoftID(swModel);
	} catch (err) {
		logger.info(`Invalid softID from ${req[SYMBOL_TachiAPIAuth].userID!}.`, { err });
		return res.status(400).json({
			success: false,
			error: `Invalid X-Software-Model.`,
		});
	}

	return next();
};

const supportedExts = [EXT_HEROIC_VERSE, EXT_BISTROVER];

const ValidateModelHeader: RequestHandler = (req, res, next) => {
	const swModel = req.header("X-Software-Model");

	if (!swModel) {
		logger.debug(
			`Rejected empty X-Software Model from user ${req[SYMBOL_TachiAPIAuth].userID!}.`
		);
		return res.status(400).json({
			success: false,
			error: `Invalid X-Software-Model.`,
		});
	}

	try {
		const softID = ParseEA3SoftID(swModel);

		if (softID.rev === REV_2DXBMS) {
			return res.status(400).send({
				success: false,
				description: "2DX_BMS is not supported.",
			});
		}

		if (softID.model === MODEL_INFINITAS_2) {
			return next(); // allow anything for inf2.
		}

		if (!supportedExts.includes(softID.ext)) {
			logger.info(
				`Rejected invalid Software Model ${softID.ext} from user ${req[SYMBOL_TachiAPIAuth]
					.userID!}.`
			);
			return res.status(400).json({
				success: false,
				description: `Invalid extension ${softID.ext}`,
			});
		}
	} catch (err) {
		logger.debug(err);
		return res.status(400).json({
			success: false,
			error: `Invalid X-Software-Model.`,
		});
	}

	return next();
};

const ValidateCards: RequestHandler = async (req, res, next) => {
	const userID = req[SYMBOL_TachiAPIAuth]!.userID!;

	const cardFilters = await db["fer-settings"].findOne({ userID });

	if (!cardFilters || !cardFilters.cards) {
		return next();
	}

	const cardID = req.header("X-Account-Id");
	if (!cardID) {
		return res.status(400).json({
			success: false,
			error: `Fervidex did not provide a card ID.`,
		});
	}

	if (!cardFilters.cards.includes(cardID)) {
		return res.status(400).json({
			success: false,
			error: `The card ID ${cardID} is not in your list of filters. Ignoring.`,
		});
	}

	return next();
};

router.use(
	RequirePermissions("submit_score"),
	ValidateFervidexHeader,
	ValidateModelHeader,
	ValidateCards
);

/**
 * Submits all of a users data to Tachi. This data is extremely minimal,
 * as only a users Lamp and Score are sent. As such, this is not the prefered
 * way of syncing scores outside of INF2, where there is no other way to
 * retrieve scores.
 *
 * @name POST /ir/fervidex/profile/submit
 */
router.post("/profile/submit", RequireInf2ModelHeaderOrForceStatic, (req, res) => {
	const headers = {
		// guaranteed to exist because of RequireInf2ModelHeader
		model: req.header("X-Software-Model")!,
	};

	// Perform a fast return here to not allow fervidex to resend requests.
	res.status(202).json({
		success: true,
		description: `Your import has been loaded for further processing.`,
		body: {},
	});

	ExpressWrappedScoreImportMain(req[SYMBOL_TachiAPIAuth].userID!, false, "ir/fervidex-static", [
		req.body,
		headers,
	]);
});

/**
 * Submits a single score to Tachi. In contrast to profile/submit, this
 * sends the most data (and most accurate data) of any score hook.
 * As such, this is the preferred way of submitting IIDX scores to Tachi.
 *
 * @name POST /ir/fervidex/score/submit
 */
router.post("/score/submit", ValidateModelHeader, async (req, res) => {
	const model = req.header("X-Software-Model");

	if (!model) {
		return res.status(400).json({
			success: false,
			error: "No X-Software-Model header provided?",
		});
	}

	const headers = {
		model,
	};

	const responseData = await ExpressWrappedScoreImportMain(
		req[SYMBOL_TachiAPIAuth].userID!,
		true,
		"ir/fervidex",
		[req.body, headers]
	);

	if (!responseData.body.success) {
		// in-air rewrite description to error.
		// @ts-expect-error Hack!
		responseData.body.error = responseData.body.description;
		// @ts-expect-error Hack!
		delete responseData.body.description;
	}

	return res.status(responseData.statusCode).json(responseData.body);
});

/**
 * Submits the result of a class to Tachi. This contains the dan played
 * and whether it was achieved.
 *
 * @name POST /ir/fervidex/class/submit
 */
router.post("/class/submit", ValidateModelHeader, async (req, res) => {
	if (!req.body.cleared) {
		return res.status(200).json({ success: true, description: "No Update Made.", body: {} });
	}

	if (!Number.isInteger(req.body.course_id)) {
		return res.status(400).json({
			success: false,
			error: `Invalid course_id ${req.body.course_id}.`,
		});
	}

	const courseID = req.body.course_id as integer;

	if (courseID < 0 || courseID > 18) {
		return res.status(400).json({
			success: false,
			error: `Invalid course_id ${req.body.course_id}.`,
		});
	}

	if (req.body.play_style !== 0 && req.body.play_style !== 1) {
		return res.status(400).json({
			success: false,
			error: `Invalid play_style ${req.body.playstyle}`,
		});
	}

	// is 0 or 1.
	const playtype: Playtypes["iidx"] = req.body.play_style === 0 ? "SP" : "DP";

	const r = await UpdateClassIfGreater(
		req[SYMBOL_TachiAPIAuth].userID!,
		"iidx",
		playtype,
		"dan",
		courseID
	);

	return res.status(200).json({
		success: true,
		description: r === false ? "Dan unchanged." : "Dan changed!",
	});
});

export default router;
