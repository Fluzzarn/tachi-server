import { integer } from "tachi-common";

export interface USCServerScore {
	score: integer;
	lamp: 0 | 1 | 2 | 3 | 4 | 5;
	timestamp: integer;
	crit: integer;
	near: integer;
	error: integer;
	ranking: integer;
	gaugeMod: "NORMAL" | "HARD" | "PERMISSIVE";
	noteMod: "NORMAL" | "MIRROR" | "RANDOM" | "MIR-RAN";
	username: string;
}

export interface USCClientScore {
	score: integer;
	gauge: number;
	timestamp: integer;
	crit: integer;
	near: integer;
	error: integer;
	early: integer | null;
	late: integer | null;
	combo: integer | null;
	options: {
		gaugeType: 0 | 1 | 2;
		gaugeOpt: integer;
		mirror: boolean;
		random: boolean;
		autoFlags: integer; //???
	};
	windows: {
		perfect: number;
		good: number;
		hold: number;
		miss: number;
		slam: number;
	};
}

export interface USCClientChart {
	chartHash: string;
	artist: string;
	title: string;
	level: integer;
	difficulty: 0 | 1 | 2 | 3;
	effector: string;
	illustrator: string;
	bpm: string;
}
