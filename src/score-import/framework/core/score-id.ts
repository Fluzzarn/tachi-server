import { DryScore } from "../../../types";
import crypto from "crypto";
import db from "../../../db/db";
import { integer } from "kamaitachi-common";

function CreateScoreIDString(userID: integer, partialScore: DryScore, chartID: string) {
    const { lamp, grade } = partialScore.scoreData;

    return `${userID}|${chartID}|${lamp}|${grade}`;
}

/**
 * Performs sha256 hashing on the input data.
 * @param scoreIDString - The string to sha256 hash.
 * @returns A sha256 checksum in lowercase hex.
 */
function HashScoreIDString(scoreIDString: string) {
    return crypto.createHash("sha256").update(scoreIDString).digest("hex");
}

/**
 * Creates an identifier for this score.
 * This is used to deduplicate repeated scores.
 * @returns @see HashScoreIDString - prefixed with R.
 */
export function CreateScoreID(userID: integer, dryScore: DryScore, chartID: string) {
    const scoreIDString = CreateScoreIDString(userID, dryScore, chartID);

    return `R${HashScoreIDString(scoreIDString)}`;
}

export function GetWithScoreID(scoreID: string) {
    return db.scores.findOne({
        scoreID,
    });
}