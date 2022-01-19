import { RequestHandler, Router } from "express";
import db from "external/mongo/db";
import { SYMBOL_TachiData } from "lib/constants/tachi";
import { ChartDocument, PBScoreDocument } from "tachi-common";
import { AssignToReqTachiData } from "utils/req-tachi-data";
import { TachiScoreDataToBeatorajaFormat } from "./convert-scores";

const router: Router = Router({ mergeParams: true });

const GetChartDocument: RequestHandler = async (req, res, next) => {
	let chart: ChartDocument<"bms:7K" | "bms:14K" | "pms:Controller" | "pms:Keyboard"> | null =
		(await db.charts.bms.findOne({
			"data.hashSHA256": req.params.chartSHA256,
		})) as ChartDocument<"bms:7K" | "bms:14K"> | null;

	// if we dont find the chart in bms,
	// it's probably a pms chart.
	if (!chart) {
		chart = (await db.charts.pms.findOne({
			"data.hashSHA256": req.params.chartSHA256,
		})) as ChartDocument<"pms:Controller" | "pms:Keyboard"> | null;
	}

	// if we still haven't found it, we've got nothin.
	if (!chart) {
		return res.status(404).json({
			success: false,
			description: `Chart does not exist on IR yet.`,
		});
	}

	AssignToReqTachiData(req, { beatorajaChartDoc: chart });

	return next();
};

router.use(GetChartDocument);

/**
 * Retrieves scores for the given chart.
 *
 * @name GET /ir/beatoraja/charts/:chartSHA256/scores
 */
router.get("/scores", async (req, res) => {
	const chart = req[SYMBOL_TachiData]!.beatorajaChartDoc!;

	const scores = (await db["personal-bests"].find({
		chartID: chart.chartID,
	})) as PBScoreDocument<"bms:7K" | "bms:14K" | "pms:Controller" | "pms:Keyboard">[];

	const userDocs = await db.users.find(
		{
			id: { $in: scores.map((e) => e.userID) },
		},
		{
			projection: {
				id: 1,
				username: 1,
			},
		}
	);

	const userMap = new Map();
	for (const user of userDocs) {
		userMap.set(user.id, user);
	}

	const beatorajaScores = [];

	for (const score of scores) {
		beatorajaScores.push(
			TachiScoreDataToBeatorajaFormat(
				score,
				chart.data.hashSHA256,
				userMap.get(score.userID).username,
				chart.data.notecount,
				0 // Playcount is always 0 at the moment due to performance concerns.
			)
		);
	}

	return res.status(200).json({
		success: true,
		description: `Successfully returned ${beatorajaScores.length}`,
		body: beatorajaScores,
	});
});

export default router;
