import { KtLogger } from "lib/logger/logger";
import nodeFetch from "utils/fetch";
import { TraverseKaiAPI } from "../../common/api-kai/traverse-api";
import { ParserFunctionReturns } from "../../common/types";
import { EmptyObject } from "utils/types";
import { ServerConfig } from "lib/setup/config";
import { CreateArcIIDXClassHandler } from "./class-handler";
import { GetArcAuthGuaranteed } from "utils/queries/auth";
import { integer } from "tachi-common";

export async function ParseArcIIDX(
	userID: integer,
	logger: KtLogger,
	fetch = nodeFetch
): Promise<ParserFunctionReturns<unknown, EmptyObject>> {
	const authDoc = await GetArcAuthGuaranteed(userID, "api/arc-iidx", logger);

	if (!ServerConfig.ARC_AUTH_TOKEN || !ServerConfig.ARC_API_URL) {
		throw new Error(
			`Cannot parse ArcIIDX withouth ARC_API_URL and ARC_AUTH_TOKEN being defined.`
		);
	}

	return {
		iterable: TraverseKaiAPI(
			ServerConfig.ARC_API_URL,
			// BISTROVER
			`/api/v1/iidx/28/player_bests?profile_id=${authDoc.accountID}`,
			ServerConfig.ARC_AUTH_TOKEN,
			logger,
			null,
			fetch
		),
		context: {},
		classHandler: await CreateArcIIDXClassHandler(
			authDoc.accountID,
			ServerConfig.ARC_AUTH_TOKEN,
			fetch
		),
		game: "iidx",
	};
}
