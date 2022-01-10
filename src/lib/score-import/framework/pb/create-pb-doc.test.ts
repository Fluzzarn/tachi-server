import deepmerge from "deepmerge";
import db from "external/mongo/db";
import CreateLogCtx, { KtLogger } from "lib/logger/logger";
import { GetGamePTConfig } from "tachi-common";
import t from "tap";
import ResetDBState from "test-utils/resets";
import { Testing511SPA, TestingBMS7KScore, TestingIIDXSPScore } from "test-utils/test-data";
import { CreatePBDoc, PBScoreDocumentNoRank } from "./create-pb-doc";

const IIDXScore = TestingIIDXSPScore;

const logger = CreateLogCtx(__filename);

const lamps = GetGamePTConfig("iidx", "SP").lamps;

t.test("#CreatePBDoc", (t) => {
	t.beforeEach(ResetDBState);

	const chartID = Testing511SPA.chartID;

	const ExamplePBDoc = {
		chartID,
		userID: 1,
		songID: 1,
		// rankingData -- is not present because it is not added until post-processing.
		highlight: false,
		isPrimary: true,
		timeAchieved: 1619454485988,
		game: "iidx",
		playtype: "SP",
		composedFrom: {
			scorePB: IIDXScore.scoreID,
			lampPB: "LAMP_PB_ID",
		},
		scoreData: {
			score: IIDXScore.scoreData.score,
			percent: IIDXScore.scoreData.percent,
			esd: IIDXScore.scoreData.esd,
			grade: IIDXScore.scoreData.grade,
			gradeIndex: IIDXScore.scoreData.gradeIndex,
			judgements: IIDXScore.scoreData.judgements,
			lamp: "FULL COMBO",
			lampIndex: lamps.indexOf("FULL COMBO"),
			hitMeta: { bp: 1 },
		},
		calculatedData: {
			ktRating: IIDXScore.calculatedData.ktRating,
			ktLampRating: 12,
		},
	};

	const ExamplePBDocBMS: PBScoreDocumentNoRank = {
		chartID,
		userID: 1,
		songID: 1,
		// rankingData -- is not present because it is not added until post-processing.
		highlight: false,
		isPrimary: true,
		timeAchieved: 1619454485988,
		game: "iidx",
		playtype: "SP",
		composedFrom: {
			scorePB: IIDXScore.scoreID,
			lampPB: "LAMP_PB_ID",
		},
		scoreData: {
			score: IIDXScore.scoreData.score,
			percent: IIDXScore.scoreData.percent,
			esd: IIDXScore.scoreData.esd,
			grade: IIDXScore.scoreData.grade,
			gradeIndex: IIDXScore.scoreData.gradeIndex,
			judgements: IIDXScore.scoreData.judgements,
			lamp: "FULL COMBO",
			lampIndex: lamps.indexOf("FULL COMBO"),
			hitMeta: { bp: 1 },
		},
		calculatedData: {
			sieglinde: 30,
		},
	};

	t.test(
		"(IIDX) Should use the GameSpecificMergeFN to also join the BP PB if necessary.",
		async (t) => {
			await db.scores.remove({});
			await db.scores.insert([
				IIDXScore,
				deepmerge(IIDXScore, {
					scoreData: {
						lamp: "FULL COMBO",
						lampIndex: lamps.indexOf("FULL COMBO"),
						score: 0,
						percent: 0,
						hitMeta: {
							bp: 15,
						},
					},
					calculatedData: {
						ktLampRating: 12,
					},
					scoreID: "LAMP_PB_ID",
				}),
				deepmerge(IIDXScore, {
					scoreData: {
						lamp: "CLEAR",
						lampIndex: lamps.indexOf("CLEAR"),
						score: 1,
						percent: 1,
						hitMeta: {
							bp: 5,
						},
					},
					calculatedData: {
						ktLampRating: 10,
					},
					scoreID: "BP_PB_ID",
				}),
			]);

			const res = await CreatePBDoc(1, chartID, logger);

			t.not(res, undefined, "Should actually return something.");

			t.strictSame(
				res,
				deepmerge(ExamplePBDoc, {
					composedFrom: {
						other: [{ name: "Best BP", scoreID: "BP_PB_ID" }],
					},
					scoreData: {
						hitMeta: {
							bp: 5,
							gsm: null,
							gauge: null,
							gaugeHistory: null,
						},
					},
				}),
				"Should correctly return a merged PBDocument with BP"
			);

			t.end();
		}
	);

	t.test("Should merge a score and lamp PB into one document.", async (t) => {
		const d = deepmerge(IIDXScore, {
			scoreData: {
				lamp: "FULL COMBO",
				lampIndex: lamps.indexOf("FULL COMBO"),
				score: 0,
				percent: 0,
				hitMeta: {
					bp: 1,
				},
			},
			calculatedData: {
				ktLampRating: 12,
			},
			scoreID: "LAMP_PB_ID",
		});

		await db.scores.remove({});
		await db.scores.insert([IIDXScore, d]);

		const res = await CreatePBDoc(1, chartID, logger);

		t.not(res, undefined, "Should actually return something.");

		t.strictSame(res, ExamplePBDoc, "Should correctly return a merged PBDocument");

		t.end();
	});

	t.test("Should bail safely if no score exists when one should", async (t) => {
		// a work of genius
		const fakeLogger = {
			severe: () => (severeCalled = true),
		} as unknown as KtLogger;

		let severeCalled = false;

		await db.scores.remove({});

		const res = await CreatePBDoc(1, chartID, fakeLogger);

		t.equal(res, undefined, "Should return nothing (and emit a warning)");

		t.equal(severeCalled, true, "Severe logging should have been called.");

		t.end();
	});

	t.test("(BMS) Should inherit sieglinde from the higher rated score.", async (t) => {
		await db.scores.remove({});
		await db.scores.insert([
			TestingBMS7KScore,
			deepmerge(TestingBMS7KScore, {
				scoreData: {
					lamp: "FULL COMBO",
					lampIndex: lamps.indexOf("FULL COMBO"),
					score: 0,
					percent: 0,
					hitMeta: {
						bp: 15,
					},
				},
				calculatedData: {
					sieglinde: 500,
				},
				scoreID: "LAMP_PB_ID",
			}),
		]);

		const res = await CreatePBDoc(1, TestingBMS7KScore.chartID, logger);

		t.not(res, undefined, "Should actually return something.");

		t.equal(
			res?.calculatedData.sieglinde,
			500,
			"Should select the lampPBs sieglinde and not the score PBs."
		);

		t.end();
	});

	t.end();
});
