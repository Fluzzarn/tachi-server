import db from "external/mongo/db";
import { KtLogger } from "lib/logger/logger";
import ScoreImportFatalError from "lib/score-import/framework/score-importing/score-import-error";
import { integer } from "tachi-common";

export function GetKaiAuth(userID: integer, service: "FLO" | "EAG" | "MIN") {
	return db["kai-auth-tokens"].findOne({
		userID,
		service,
	});
}

export async function GetKaiAuthGuaranteed(
	userID: integer,
	service: "FLO" | "EAG" | "MIN",
	logger: KtLogger
) {
	const authDoc = await GetKaiAuth(userID, service);

	if (!authDoc) {
		logger.error(`No authentication was stored for ${service}.`);
		throw new ScoreImportFatalError(401, `No authentication was stored for ${service}.`);
	}

	return authDoc;
}

export function GetArcAuth(userID: integer, forImportType: "api/arc-iidx" | "api/arc-sdvx") {
	return db["arc-saved-profiles"].findOne({
		userID,
		forImportType,
	});
}

export async function GetArcAuthGuaranteed(
	userID: integer,
	forImportType: "api/arc-iidx" | "api/arc-sdvx",
	logger: KtLogger
) {
	const authDoc = await GetArcAuth(userID, forImportType);

	if (!authDoc) {
		logger.error(`No authentication was stored for ${forImportType}.`);
		throw new ScoreImportFatalError(401, `No authentication was stored for ${forImportType}.`);
	}

	return authDoc;
}
