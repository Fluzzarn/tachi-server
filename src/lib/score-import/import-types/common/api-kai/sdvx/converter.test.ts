import deepmerge from "deepmerge";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import t from "tap";
import ResetDBState from "test-utils/resets";
import { GetKTDataJSON, TestingAlbidaADV, TestingSDVXAlbidaSong } from "test-utils/test-data";
import { ConvertAPIKaiSDVX, ConvertDifficulty, ConvertVersion, ResolveKaiLamp } from "./converter";

const logger = CreateLogCtx(__filename);

const sdvxScore = GetKTDataJSON("./api-kai/sdvx-score.json");

t.test("#ConvertAPIKaiSDVX", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should return a dryScore on valid input.", async (t) => {
		const res = await ConvertAPIKaiSDVX(sdvxScore, { service: "FLO" }, "api/flo-sdvx", logger);

		t.hasStrict(res, {
			song: TestingSDVXAlbidaSong,
			chart: TestingAlbidaADV,
			dryScore: {
				comment: null,
				game: "sdvx",
				importType: "api/flo-sdvx",
				timeAchieved: 1598792891000,
				service: "FLO",
				scoreData: {
					grade: "AA",
					// percent: 93.10699, floating point
					score: 9310699,
					lamp: "CLEAR",
					judgements: {},
					hitMeta: {
						fast: 70,
						slow: 42,
						gauge: 90,
						maxCombo: 179,
					},
				},
				scoreMeta: {},
			},
		});

		t.end();
	});

	t.test("Should throw KTDataNotFound on unknown chart", (t) => {
		t.rejects(
			() =>
				ConvertAPIKaiSDVX(
					deepmerge(sdvxScore, { music_id: 0 }),
					{ service: "FLO" },
					"api/flo-sdvx",
					logger
				),
			{
				message: /Could not find chart with songID 0 \(ADV - Version vivid\)/u,
			}
		);

		t.end();
	});

	t.test("Should throw InvalidScoreFailure on invalid score", (t) => {
		t.rejects(
			() =>
				ConvertAPIKaiSDVX(
					deepmerge(sdvxScore, { music_id: "foo" }),
					{ service: "FLO" },
					"api/flo-sdvx",
					logger
				),
			{
				message: /Error: music_id.*Expected a positive integer.* received foo \[string\]/iu,
			}
		);

		t.end();
	});

	t.test("Should throw InternalFailure on song-chart desync", async (t) => {
		await db.songs.sdvx.remove({});

		t.rejects(() => ConvertAPIKaiSDVX(sdvxScore, { service: "FLO" }, "api/flo-sdvx", logger), {
			message: /Song-Chart desync/u,
		});

		t.end();
	});

	t.end();
});

t.test("#ConvertDifficulty", (t) => {
	t.equal(ConvertDifficulty(0), "NOV");
	t.equal(ConvertDifficulty(1), "ADV");
	t.equal(ConvertDifficulty(2), "EXH");
	t.equal(ConvertDifficulty(3), "ANY_INF");
	t.equal(ConvertDifficulty(4), "MXM");
	t.throws(() => ConvertDifficulty(5));

	t.end();
});

t.test("#ConvertVersion", (t) => {
	t.equal(ConvertVersion(1), "booth");
	t.equal(ConvertVersion(2), "inf");
	t.equal(ConvertVersion(3), "gw");
	t.equal(ConvertVersion(4), "heaven");
	t.equal(ConvertVersion(5), "vivid");
	t.throws(() => ConvertVersion(6));
	t.throws(() => ConvertVersion(0));

	t.end();
});

t.test("#ResolveKaiLamp", (t) => {
	t.equal(ResolveKaiLamp(1), "FAILED");
	t.equal(ResolveKaiLamp(2), "CLEAR");
	t.equal(ResolveKaiLamp(3), "EXCESSIVE CLEAR");
	t.equal(ResolveKaiLamp(4), "ULTIMATE CHAIN");
	t.equal(ResolveKaiLamp(5), "PERFECT ULTIMATE CHAIN");
	t.throws(() => ResolveKaiLamp(6));
	t.throws(() => ResolveKaiLamp(0));

	t.end();
});
