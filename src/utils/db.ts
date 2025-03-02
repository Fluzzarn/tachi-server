import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import { Game, integer, PBScoreDocument, ScoreDocument } from "tachi-common";
const logger = CreateLogCtx(__filename);

export async function GetNextCounterValue(counterName: string): Promise<integer> {
	const sequenceDoc = await db.counters.findOneAndUpdate(
		{
			counterName,
		},
		{
			$inc: {
				value: 1,
			},
		},
		{
			// this is marked as deprecated, but it shouldn't be, as returnDocument: "before"
			// does nothing.
			returnOriginal: true,
		}
	);

	if (!sequenceDoc) {
		logger.error(`Could not find sequence document for ${counterName}`);
		throw new Error(`Could not find sequence document for ${counterName}.`);
	}

	return sequenceDoc.value;
}

export async function DecrementCounterValue(counterName: string): Promise<integer> {
	logger.verbose(`Decrementing Counter Value ${counterName}.`);

	const sequenceDoc = await db.counters.findOneAndUpdate(
		{
			counterName,
		},
		{
			$inc: {
				value: -1,
			},
		},
		{
			returnOriginal: false,
		}
	);

	if (!sequenceDoc) {
		logger.error(`Could not find sequence document for ${counterName}`);
		throw new Error(`Could not find sequence document for ${counterName}.`);
	}

	return sequenceDoc.value;
}

export async function GetRelevantSongsAndCharts(
	scores: (ScoreDocument | PBScoreDocument)[],
	game: Game
) {
	const [songs, charts] = await Promise.all([
		db.songs[game].find({
			id: { $in: scores.map((e) => e.songID) },
		}),
		db.charts[game].find({
			chartID: { $in: scores.map((e) => e.chartID) },
		}),
	]);

	return { songs, charts };
}

export async function UpdateGameSongIDCounter(game: "bms" | "pms") {
	const largestSongID = await db.songs[game].findOne(
		{},
		{
			sort: { id: -1 },
			projection: { id: 1 },
		}
	);

	if (!largestSongID) {
		logger.severe(
			`No ${game} charts loaded, yet BMS sync was attempted? Lost state on ${game}-song-id counter. Panicking.`
		);
		throw new Error(`No BMS charts loaded, yet BMS sync was attempted.`);
	}

	await db.counters.update(
		{
			counterName: `${game}-song-id`,
		},
		{
			$set: {
				value: largestSongID.id + 1,
			},
		}
	);
}
