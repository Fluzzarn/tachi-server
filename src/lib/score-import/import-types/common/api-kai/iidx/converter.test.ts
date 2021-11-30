import deepmerge from "deepmerge";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import t from "tap";
import ResetDBState from "test-utils/resets";
import { GetKTDataJSON, Testing511Song, Testing511SPA } from "test-utils/test-data";
import { ConvertAPIKaiIIDX } from "./converter";

const logger = CreateLogCtx(__filename);

const iidxScore = GetKTDataJSON("./api-kai/iidx-score.json");

t.test("#ConvertAPIKaiIIDX", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should return a dryScore on valid input.", async (t) => {
		const res = await ConvertAPIKaiIIDX(iidxScore, { service: "FLO" }, "api/flo-iidx", logger);

		t.hasStrict(res, {
			song: Testing511Song,
			chart: Testing511SPA,
			dryScore: {
				comment: null,
				game: "iidx",
				importType: "api/flo-iidx",
				timeAchieved: 1604171450000,
				service: "FLO",
				scoreData: {
					grade: "MAX-",
					// percent: 99.87277353689568 floating point,
					score: 1570,
					lamp: "HARD CLEAR",
					judgements: {},
					hitMeta: {
						fast: null,
						slow: null,
						bp: 24,
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
				ConvertAPIKaiIIDX(
					deepmerge(iidxScore, { music_id: 0 }),
					{ service: "FLO" },
					"api/flo-iidx",
					logger
				),
			{
				message: /Could not find chart with songID 0 \(SP ANOTHER - Version 26\)/u,
			}
		);

		t.end();
	});

	t.test("Should throw InvalidScoreFailure on invalid score", (t) => {
		t.rejects(
			() =>
				ConvertAPIKaiIIDX(
					deepmerge(iidxScore, { music_id: "foo" }),
					{ service: "FLO" },
					"api/flo-iidx",
					logger
				),
			{
				message: /Error: music_id.*Expected a positive integer.* received foo \[string\]/iu,
			}
		);

		t.end();
	});

	t.test("Should throw InternalFailure on song-chart desync", async (t) => {
		await db.songs.iidx.remove({});

		t.rejects(() => ConvertAPIKaiIIDX(iidxScore, { service: "FLO" }, "api/flo-iidx", logger), {
			message: /Song-Chart desync/u,
		});

		t.end();
	});

	t.end();
});
