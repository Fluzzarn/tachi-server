import db from "external/mongo/db";
import fs from "fs";
import {
	USC_DEFAULT_HOLD,
	USC_DEFAULT_MISS,
	USC_DEFAULT_NEAR,
	USC_DEFAULT_PERFECT,
	USC_DEFAULT_SLAM,
} from "lib/constants/usc-ir";
import { DryScore } from "lib/score-import/framework/common/types";
import { BarbatosScore } from "lib/score-import/import-types/ir/barbatos/types";
import { KsHookSV3CScore } from "lib/score-import/import-types/ir/kshook-sv3c/types";
import { LR2HookScore } from "lib/score-import/import-types/ir/lr2hook/types";
import path from "path";
import { USCClientScore } from "server/router/ir/usc/_playtype/types";
import {
	ChartDocument,
	FolderDocument,
	GoalDocument,
	MilestoneDocument,
	PBScoreDocument,
	ScoreDocument,
	SongDocument,
	UserGoalDocument,
} from "tachi-common";
import { ApplyNTimes, RFA } from "utils/misc";

const file = (name: string) => path.join(__dirname, "/test-data", name);

export const GetKTDataJSON = (name: string) => JSON.parse(fs.readFileSync(file(name), "utf-8"));
export const GetKTDataBuffer = (name: string) => fs.readFileSync(file(name));

export const TestingIIDXSPDryScore = GetKTDataJSON(
	"./tachi/iidx-dryscore.json"
) as DryScore<"iidx:SP">;

export const TestingIIDXSPScorePB = GetKTDataJSON(
	"./tachi/iidx-scorepb.json"
) as PBScoreDocument<"iidx:SP">;
export const TestingIIDXSPScore = GetKTDataJSON(
	"./tachi/iidx-score.json"
) as ScoreDocument<"iidx:SP">;

export const TestingKsHookSV3CScore = GetKTDataJSON("./kshook-sv3c/base.json") as KsHookSV3CScore;

export const TestingLR2HookScore: LR2HookScore = {
	md5: "38616b85332037cc12924f2ae2840262",
	playerData: {
		autoScr: false,
		gameMode: "7K",
		random: "RAN",
		gauge: "GROOVE",
	},
	scoreData: {
		pgreat: 1000,
		great: 500,
		good: 100,
		bad: 50,
		poor: 25,
		exScore: 2500,
		maxCombo: 50,
		moneyScore: 150_000,
		notesTotal: 2256,
		notesPlayed: 2256,
		lamp: "HARD",
		hpGraph: ApplyNTimes(1000, () => RFA([100, 50, 80, 0])),
	},
};

export const Testing511SPA = GetKTDataJSON("./tachi/iidx-511spa.json") as ChartDocument<"iidx:SP">;

export const Testing511Song = GetKTDataJSON("./tachi/iidx-511-song.json") as SongDocument<"iidx">;

export const TestingAlbidaADV = GetKTDataJSON(
	"./tachi/sdvx-albida-chart.json"
) as ChartDocument<"sdvx:Single">;

export const TestingSDVXAlbidaSong = GetKTDataJSON(
	"./tachi/sdvx-albida-song.json"
) as SongDocument<"sdvx">;

export const TestingDoraChart = GetKTDataJSON(
	"./tachi/gitadora-ithinkabtyou.json"
) as ChartDocument<"gitadora:Dora">;

export const TestingSDVXSingleDryScore = GetKTDataJSON(
	"./tachi/sdvx-dryscore.json"
) as DryScore<"sdvx:Single">;

export const TestingGITADORADoraDryScore = GetKTDataJSON(
	"./tachi/gitadora-dryscore.json"
) as DryScore<"gitadora:Dora">;

export const TestingIIDXEamusementCSV26 = GetKTDataBuffer(
	"./eamusement-iidx-csv/pre-leggendaria.csv"
);
export const TestingIIDXEamusementCSV27 = GetKTDataBuffer(
	"./eamusement-iidx-csv/post-leggendaria.csv"
);

export const TestingSDVXEamusementCSV = GetKTDataBuffer(
	"./eamusement-sdvx-csv/exceed-gear-score.csv"
);

export const TestingBarbatosScore: BarbatosScore = GetKTDataJSON("./barbatos/base.json");

export const HC511Goal: GoalDocument = {
	charts: {
		type: "single",
		data: Testing511SPA.chartID,
	},
	createdBy: 1,
	game: "iidx",
	goalID: "mock_goalID",
	playtype: "SP",
	timeAdded: 0,
	title: "HC 5.1.1. SPA",
	criteria: {
		mode: "single",
		value: 5,
		key: "scoreData.lampIndex",
	},
};

export const HC511UserGoal: UserGoalDocument = {
	achieved: false,
	timeAchieved: null,
	game: "iidx",
	playtype: "SP",
	goalID: "mock_goalID",
	lastInteraction: null,
	outOf: 5,
	outOfHuman: "HARD CLEAR",
	progress: null,
	progressHuman: "NO DATA",
	timeSet: 0,
	userID: 1,
};

export const TestingIIDXFolderSP10: FolderDocument = {
	title: "Level 10",
	game: "iidx",
	playtype: "SP",
	type: "charts",
	folderID: "ed9d8c734447ce67d7135c0067441a98cc81aeaf",
	data: {
		level: "10",
	},
	searchTerms: [],
	inactive: false,
};

export const TestingIIDXSPMilestone: MilestoneDocument = {
	createdBy: 1,
	criteria: {
		type: "all",
	},
	desc: "testing milestone",
	game: "iidx",
	playtype: "SP",
	group: "ExampleGroup",
	groupIndex: 1,
	milestoneID: "example_milestone_id",
	name: "Example Milestone",
	milestoneData: [
		{
			title: "Group1",
			desc: "Foo",
			goals: [
				{
					goalID: "eg_goal_1",
				},
				{
					goalID: "eg_goal_2",
				},
			],
		},
		{
			title: "Group2",
			desc: "Bar",
			goals: [
				{
					goalID: "eg_goal_3",
				},
				{
					goalID: "eg_goal_4",
				},
			],
		},
	],
};

let KTDATA_CACHE: { songs: unknown[]; charts: unknown[] } | undefined;

export async function LoadTachiIIDXData() {
	let songs;
	let charts;

	if (KTDATA_CACHE) {
		songs = KTDATA_CACHE.songs;
		charts = KTDATA_CACHE.charts;
	} else {
		songs = GetKTDataJSON("./tachi/tachi-songs-iidx.json");
		charts = GetKTDataJSON("./tachi/tachi-charts-iidx.json");
		KTDATA_CACHE = { songs, charts };
	}

	await db.songs.iidx.remove({});
	await db.songs.iidx.insert(songs);
	await db.charts.iidx.remove({});
	await db.charts.iidx.insert(charts);
}

export const barbScore: BarbatosScore = {
	clear_type: 2,
	did_fail: false,
	difficulty: 1,
	critical: 100,
	error: 5,
	near_total: 50,
	near_fast: 40,
	near_slow: 10,
	gauge_type: 1,
	is_skill_analyzer: false,
	level: 10,
	max_chain: 100,
	percent: 90,
	score: 9_000_000,
	song_id: 1,
};

export const uscChart: ChartDocument<"usc:Controller" | "usc:Keyboard"> = {
	rgcID: null,
	chartID: "USC_CHART_ID",
	difficulty: "NOV",
	songID: 1,
	playtype: "Keyboard",
	levelNum: 1,
	level: "1",
	data: {
		hashSHA1: "USC_CHART_HASH",
		isOfficial: false,
	},
	tierlistInfo: {},
	isPrimary: true,
	versions: [],
};

export const uscScore: USCClientScore = {
	crit: 100,
	error: 5,
	near: 50,
	gauge: 0.8,
	early: 50,
	late: 20,
	combo: 5,
	options: {
		autoFlags: 0,
		gaugeOpt: 0,
		gaugeType: 1,
		mirror: true,
		random: false,
	},
	score: 9_000_000,
	timestamp: 0,
	windows: {
		good: USC_DEFAULT_NEAR,
		perfect: USC_DEFAULT_PERFECT,
		hold: USC_DEFAULT_HOLD,
		miss: USC_DEFAULT_MISS,
		slam: USC_DEFAULT_SLAM,
	},
};
