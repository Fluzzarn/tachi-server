import { Router } from "express";
import db from "external/mongo/db";
import { SYMBOL_TachiAPIAuth } from "lib/constants/tachi";
import CreateLogCtx from "lib/logger/logger";
import { ExpressWrappedScoreImportMain } from "lib/score-import/framework/express-wrapper";
import { ServerConfig } from "lib/setup/config";
import { RequireNotGuest } from "server/middleware/auth";
import { UpdateClassIfGreater } from "utils/class";
import { ValidateIRClientVersion } from "./auth";
import chartsRouter from "./charts/_chartSHA256/router";

const logger = CreateLogCtx(__filename);

const router: Router = Router({ mergeParams: true });

router.use(ValidateIRClientVersion);

/**
 * Submits a beatoraja score to Tachi.
 *
 * @name POST /ir/beatoraja/submit-score
 */
router.post("/submit-score", RequireNotGuest, async (req, res) => {
	const userID = req[SYMBOL_TachiAPIAuth]!.userID!;

	const importRes = await ExpressWrappedScoreImportMain(userID, false, "ir/beatoraja", [
		req.body,
		userID,
	]);

	if (!importRes.body.success) {
		return res.status(400).json(importRes.body);
	} else if (importRes.body.body.errors.length !== 0) {
		const type = importRes.body.body.errors[0].type;
		const errMsg = importRes.body.body.errors[0].message;

		if (type === "KTDataNotFound") {
			return res.status(202).json({
				success: true,
				description: `Chart and score have been orphaned. This score will reify when atleast ${ServerConfig.BEATORAJA_QUEUE_SIZE} players have played the chart.`,
			});
		} else if (type === "InternalError") {
			return res.status(500).json({
				success: false,
				description: `[${type}] - ${errMsg}`,
			});
		}

		// since we're only ever importing one score, we can guarantee
		// that this means the score we tried to import was skipped.

		return res.status(400).json({
			success: false,
			description: `[${type}] - ${errMsg}`,
		});
	} else if (importRes.body.body.scoreIDs.length === 0) {
		return res.status(400).json({
			success: false,
			description: `No scores were imported.`,
		});
	}

	const scoreDoc = await db.scores.findOne({
		scoreID: importRes.body.body.scoreIDs[0],
	});

	if (!scoreDoc) {
		logger.severe(
			`ScoreDocument ${importRes.body.body.scoreIDs[0]} was claimed to be inserted, but wasn't.`
		);
		return res.status(500).json({
			success: false,
			description: "Internal Service Error.",
		});
	}

	const chart = await db.charts.bms.findOne({
		chartID: scoreDoc.chartID,
	});

	const song = await db.songs.bms.findOne({
		id: chart!.songID,
	});

	return res.status(importRes.statusCode).json({
		success: true,
		description: "Imported score.",
		body: {
			score: scoreDoc,
			song,
			chart,
			import: importRes.body.body,
		},
	});
});

/**
 * Submits a course result to Tachi. This only accepts a limited set of
 * courses - all of which are dans.
 *
 * @name POST /ir/beatoraja/submit-course
 */
router.post("/submit-course", RequireNotGuest, async (req, res) => {
	const charts = req.body.course?.charts;

	if (
		!charts ||
		!Array.isArray(charts) ||
		charts.length !== 4 ||
		!charts.every((e) => e && typeof e === "object" && typeof e.md5 === "string")
	) {
		return res.status(400).json({
			success: false,
			description: `Invalid Course Submission.`,
		});
	}

	const clear = req.body.score?.clear;

	if (!clear || clear === "Failed") {
		return res.status(200).json({
			success: true,
			description: "Class not updated.",
		});
	}

	if (req.body.score?.lntype !== 0) {
		return res.status(400).json({
			success: false,
			description: "LN mode is the only supported mode for dans.",
		});
	}

	// Constraints are a bit complicated.
	// We only want to accept dans with the following
	// beatoraja constraints - ["MIRROR","GAUGE_LR2"] or
	// ["MIRROR", "GAUGE_LR2", "LN"].
	const constraint = req.body.course.constraint;

	if (
		!constraint ||
		!Array.isArray(constraint) ||
		(constraint.length !== 2 && constraint.length !== 3)
	) {
		return res.status(400).json({
			success: false,
			description: `Invalid Constraints.`,
		});
	}

	// If there are two constraints, check that they are
	// MIRROR and GAUGE_LR2.
	if (!constraint.includes("MIRROR") || !constraint.includes("GAUGE_LR2")) {
		return res.status(400).json({
			success: false,
			description: `Invalid Constraints.`,
		});
	}

	// If there are three constraints, check that the third
	// is LN
	if (constraint.length === 3) {
		if (!constraint.includes("LN")) {
			return res.status(400).json({
				success: false,
				description: `Invalid Constraints.`,
			});
		}
	}

	// Combine the md5s into one string in their order.
	const combinedMD5s = charts.map((e) => e.md5).join("");

	const course = await db["bms-course-lookup"].findOne({
		md5sums: combinedMD5s,
	});

	if (!course) {
		return res.status(404).json({
			success: false,
			description: `Unsupported course.`,
		});
	}

	const userID = req[SYMBOL_TachiAPIAuth]!.userID!;

	const result = await UpdateClassIfGreater(
		userID,
		"bms",
		course.playtype,
		course.set,
		course.value
	);

	if (result === false) {
		return res.status(200).json({
			success: true,
			description: "Class not updated.",
			body: {
				set: course.set,
				value: course.value,
			},
		});
	}

	return res.status(200).json({
		success: true,
		description: "Successfully updated class.",
		body: {
			set: course.set,
			value: course.value,
		},
	});
});

router.use("/charts/:chartSHA256", chartsRouter);

export default router;
