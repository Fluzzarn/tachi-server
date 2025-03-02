import deepmerge from "deepmerge";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import t from "tap";
import ResetDBState from "test-utils/resets";
import { barbScore } from "test-utils/test-data";
import { ConverterIRBarbatos } from "./converter";
import { BarbatosScore } from "./types";

const logger = CreateLogCtx(__filename);

t.test("#ConverterIRBarbatos", (t) => {
	t.beforeEach(ResetDBState);

	const albidaSong = {
		title: "ALBIDA Powerless Mix",
		artist: "無力P",
		id: 1,
		altTitles: [],
		searchTerms: ["albida_muryoku", "ｱﾙﾋﾞﾀﾞﾊﾟﾜｰﾚｽﾐｯｸｽ"],
		data: {
			uscEquiv: null,
			displayVersion: "booth",
		},
	};

	const albidaChart = {
		rgcID: null,
		chartID: "5088a4d0e1ee9d0cc2f625934306e45b1a60699b",
		difficulty: "ADV",
		songID: 1,
		playtype: "Single",
		levelNum: 10,
		level: "10",
		data: {
			inGameID: 1,
		},
		isPrimary: true,
		versions: ["booth", "inf", "gw", "heaven", "vivid"],
	};

	t.test("Should convert a BarbatosScore into a Dry Score", async (t) => {
		const res = await ConverterIRBarbatos(
			barbScore,
			{ timeReceived: 10 },
			"ir/barbatos",
			logger
		);

		t.hasStrict(res, {
			song: albidaSong,
			chart: albidaChart,
			dryScore: {
				game: "sdvx",
				service: "Barbatos",
				comment: null,
				importType: "ir/barbatos",
				// timeAchieved: , its Date.now() give or take lol
				scoreData: {
					score: 9000000,
					percent: 90,
					grade: "A+",
					lamp: "CLEAR",
					judgements: {
						critical: 100,
						near: 50,
						miss: 5,
					},
					hitMeta: {
						fast: 40,
						slow: 10,
						gauge: 90,
						maxCombo: 100,
					},
				},
				scoreMeta: {
					inSkillAnalyser: false,
				},
			},
		});

		t.end();
	});

	t.test("Should throw KTDataNotFound if chart not found.", (t) => {
		t.rejects(
			() =>
				ConverterIRBarbatos(
					deepmerge(barbScore, { song_id: 1000 }) as BarbatosScore,
					{ timeReceived: 10 },
					"ir/barbatos",
					logger
				),
			{
				message: /Could not find chart with songID 1000/u,
			}
		);

		t.end();
	});

	t.test("Should throw InternalFailure if song-chart desync.", async (t) => {
		await db.songs.sdvx.remove({ id: 1 }); // force a song-chart desync

		t.rejects(
			() => ConverterIRBarbatos(barbScore, { timeReceived: 10 }, "ir/barbatos", logger),
			{
				message: /Song 1 \(sdvx\) has no parent song/u,
			}
		);

		t.end();
	});

	t.end();
});
