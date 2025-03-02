import db from "external/mongo/db";
import { KtLogger } from "lib/logger/logger";
import { integer } from "tachi-common";
import { CreatePBDoc, PBScoreDocumentNoRank, UpdateChartRanking } from "./create-pb-doc";

/**
 * Process, recalculate and update a users PBs for this set of chartIDs.
 */
export async function ProcessPBs(
	userID: integer,
	chartIDs: Set<string>,
	logger: KtLogger
): Promise<void> {
	if (chartIDs.size === 0) {
		return;
	}

	const promises = [];

	for (const chartID of chartIDs) {
		promises.push(CreatePBDoc(userID, chartID, logger));
	}

	const pbDocsReturn = await Promise.all(promises);

	const pbDocs: PBScoreDocumentNoRank[] = [];

	for (const doc of pbDocsReturn) {
		if (!doc) {
			continue;
		}

		pbDocs.push(doc);
	}

	if (pbDocsReturn.length === 0) {
		return;
	}

	// so here's the kinda awkward part - for the time between this operation
	// and the next one - THE SCORE PBS ARE IN THE DATABASE WITHOUT RANKINGDATA.
	// this *is* bad behaviour, but I don't have a nice way to fix it.
	// This should be fixed in the future to avoid crashes between these two
	// calls - but that is unlikely.
	await db["personal-bests"].bulkWrite(
		pbDocs.map((e) => ({
			updateOne: {
				filter: { chartID: e.chartID, userID: e.userID },
				update: { $set: e },
				upsert: true,
			},
		})),
		{
			ordered: false,
		}
	);

	// now that everything has been updated or inserted, we can refresh
	// the chart rankings.
	await Promise.all(pbDocs.map((e) => UpdateChartRanking(e.chartID)));

	// and we're done!
}
