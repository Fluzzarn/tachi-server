import { integer } from "tachi-common";

export interface KaiIIDXScore {
	music_id: integer;
	play_style: "SINGLE" | "DOUBLE";
	difficulty: "BEGINNER" | "NORMAL" | "HYPER" | "ANOTHER" | "LEGGENDARIA";
	version_played: integer;
	lamp: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
	ex_score: integer;
	miss_count: integer | null; // -1 => null
	fast_count: integer | null;
	slow_count: integer | null;
	timestamp: string;
}

export interface KaiSDVXScore {
	music_id: integer;
	music_difficulty: 0 | 1 | 2 | 3 | 4;
	played_version: integer;
	clear_type: 0 | 1 | 2 | 3 | 4; // hm
	score: integer;
	max_chain: integer;
	critical: integer;
	near: integer;
	error: integer | null;
	early: integer | null;
	late: integer | null;
	gauge_type: 0 | 1 | 2 | 3;
	gauge_rate: integer;
	timestamp: string;
}

export interface KaiContext {
	service: "FLO" | "EAG" | "MIN";
}
