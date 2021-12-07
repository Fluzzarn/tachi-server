import { SDVXDans } from "lib/constants/classes";
import { ClassHandler } from "lib/score-import/framework/user-game-stats/types";
import nodeFetch from "utils/fetch";
import { KaiTypeToBaseURL } from "../utils";

export async function CreateKaiSDVXClassHandler(
	kaiType: "FLO" | "EAG" | "MIN",
	token: string,
	fetch = nodeFetch
): Promise<ClassHandler> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let json: any;
	let err: unknown;
	const baseUrl = KaiTypeToBaseURL(kaiType);

	// SP and DP dans are located in the same place,
	// fetch once, then return a function that traverses this data.
	try {
		const res = await fetch(`${baseUrl}/api/sdvx/v1/player_profile`, {
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		json = await res.json();
	} catch (e) {
		err = e;
	}

	return (game, playtype, userID, ratings, logger) => {
		if (err) {
			logger.error(`An error occured while updating classes for ${baseUrl}.`, { err });
			return {};
		}

		const sdvxDan: number | null = json.skill_level - 1;

		if (json.skill_level === null || json.skill_level === undefined) {
			return {};
		}

		if (!Number.isInteger(sdvxDan)) {
			logger.warn(`${baseUrl} returned a dan of ${sdvxDan}, which was not a number.`);
			return {};
		}

		if (sdvxDan > SDVXDans.INF) {
			logger.warn(
				`${baseUrl} returned a dan of ${sdvxDan}, which was greater than INF (${SDVXDans.INF}.)`
			);
			return {};
		}

		// Kai APIs return -1 to indicate no dan. They also sometimes return undefined.
		// I'm not too sure why.
		if (sdvxDan === -1) {
			return {};
		}

		if (sdvxDan < SDVXDans.DAN_1) {
			logger.warn(
				`${baseUrl} returned a dan of ${sdvxDan}, which was less than DAN_1 (${SDVXDans.DAN_1}.)`
			);
			return {};
		}

		return {
			dan: sdvxDan,
		};
	};
}
