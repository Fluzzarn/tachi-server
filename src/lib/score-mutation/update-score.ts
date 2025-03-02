/* eslint-disable no-await-in-loop */
import db from "external/mongo/db";
import { KtLogger, rootLogger } from "lib/logger/logger";
import { CreateCalculatedData } from "lib/score-import/framework/calculated-data/calculated-data";
import { UpdateChartRanking } from "lib/score-import/framework/pb/create-pb-doc";
import { CreateScoreID } from "lib/score-import/framework/score-importing/score-id";
import { ScoreDocument } from "tachi-common";
import { UpdateAllPBs } from "utils/calculations/recalc-scores";
import { FormatUserDoc, GetUserWithID } from "utils/user";

/**
 * Updates a score from oldScore to newScore, applying all necessary state
 * changes on the way.
 *
 * @note You don't need to recalc the scoreID for newScore, it's done for you.
 */
export default async function UpdateScore(
	oldScore: ScoreDocument,
	newScore: ScoreDocument,
	updateOldChart = true
) {
	const userID = oldScore.userID;
	const user = await GetUserWithID(userID);

	if (!user) {
		rootLogger.severe(
			`User ${userID} does not exist, yet a score update was called for them? Panicking.`
		);
		throw new Error(
			`User ${userID} does not exist, yet a score update was called for them? Panicking.`
		);
	}

	const chartID = newScore.chartID;

	const chart = await db.charts[oldScore.game].findOne({
		chartID,
	});

	if (!chart) {
		rootLogger.severe(
			`Chart ${chartID} does not exist, yet a score update was called for it? Panicking.`
		);
		throw new Error(
			`Chart ${chartID} does not exist, yet a score update was called for it? Panicking.`
		);
	}

	const oldScoreID = oldScore.scoreID;

	const newScoreID = CreateScoreID(newScore.userID, newScore, newScore.chartID);

	// We need to change *so* many references to score IDs, and recalculate *so*
	// much stored state. Obviously, changing a scoreID is an exceptional circumstance
	// brought on by a bug.
	// So hopefully, we wont have to use this much.

	newScore.scoreID = newScoreID;

	const logger = rootLogger.child({
		context: ["Update Score", oldScore.scoreID, newScore.scoreID, FormatUserDoc(user)],
	}) as KtLogger;

	logger.verbose("Received Update Score request.");

	newScore.calculatedData = await CreateCalculatedData(
		newScore,
		chart,
		newScore.scoreData.esd,
		logger
	);

	try {
		// Having _id defined will cause this to throw, causing it to not apply
		// the update.
		if (newScore._id) {
			logger.warn(
				`Passed a score with _id to UpdateScore. This property should not be set. Deleting this property and continuing anyway.`
			);
			// This property shouldn't be defined.
			delete newScore._id;
		}

		await db.scores.update(
			{
				scoreID: oldScoreID,
			},
			{ $set: newScore }
		);
	} catch (err) {
		logger.error(err);
		logger.warn(
			`Score ID ${newScoreID} already existed -- this update caused a collision. Removing old score and updating old references anyway.`
		);
		await db.scores.remove({
			scoreID: oldScoreID,
		});
	}

	const sessions = await db.sessions.find({
		"scoreInfo.scoreID": oldScoreID,
	});

	logger.verbose(`Updating ${sessions.length} sessions.`);

	// For every session that interacts with this score ID (there should only ever be one)
	for (const session of sessions) {
		// Go over all the scoreInfo and alter the ones that involve this scoreID.
		for (const scoreInfo of session.scoreInfo) {
			// If this scoreInfo needs to be changed
			if (scoreInfo.scoreID === oldScoreID) {
				scoreInfo.scoreID = newScoreID;

				// If there's any cached grade/lamp diffs, we need to update them.
				if (!scoreInfo.isNewScore) {
					const gradeDiff = oldScore.scoreData.gradeIndex - newScore.scoreData.gradeIndex;
					const lampDiff = oldScore.scoreData.lampIndex - newScore.scoreData.lampIndex;
					const percentDiff = oldScore.scoreData.percent - newScore.scoreData.percent;
					const scoreDiff = oldScore.scoreData.score - newScore.scoreData.score;

					scoreInfo.gradeDelta -= gradeDiff;
					scoreInfo.lampDelta -= lampDiff;
					scoreInfo.scoreDelta -= scoreDiff;
					scoreInfo.percentDelta -= percentDiff;
				}
			}
		}

		await db.sessions.update(
			{
				sessionID: session.sessionID,
			},
			{
				$set: { scoreInfo: session.scoreInfo },
			}
		);
	}

	logger.verbose(`Updating PBs.`);

	// Update the PBs to reference properly.
	// We run updateAllPbs on just the modified chart -- the reason
	// for this is to update ranking info incase that might fall out of
	// sync as a result.
	await UpdateAllPBs([userID], {
		chartID: newScore.chartID,
	});

	await UpdateChartRanking(newScore.chartID);

	if (updateOldChart) {
		await UpdateAllPBs([userID], {
			chartID: oldScore.chartID,
		});
		await UpdateChartRanking(oldScore.chartID);
	}

	const imports = await db.imports.find({
		scoreIDs: oldScoreID,
	});

	logger.verbose(`Updating ${imports.length} imports.`);

	for (const importDoc of imports) {
		await db.imports.update(
			{
				importID: importDoc.importID,
			},
			{
				$set: {
					scoreIDs: importDoc.scoreIDs.map((e) => (e === oldScoreID ? newScoreID : e)),
				},
			}
		);
	}

	logger.verbose(`Done updating score.`);
}
