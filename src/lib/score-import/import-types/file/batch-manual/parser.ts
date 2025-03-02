import { KtLogger } from "lib/logger/logger";
import { BatchManualScore } from "tachi-common";
import ScoreImportFatalError from "../../../framework/score-importing/score-import-error";
import { ParseBatchManualFromObject } from "../../common/batch-manual/parser";
import { BatchManualContext } from "../../common/batch-manual/types";
import { ParserFunctionReturns } from "../../common/types";

/**
 * Parses a buffer of BATCH-MANUAL data.
 * @param fileData - The buffer to parse.
 * @param body - The request body that made this file import request.
 */
function ParseBatchManual(
	fileData: Express.Multer.File,
	body: Record<string, unknown>,
	logger: KtLogger
): ParserFunctionReturns<BatchManualScore, BatchManualContext> {
	let jsonData: unknown;

	try {
		jsonData = JSON.parse(fileData.buffer.toString("utf-8"));
	} catch (err) {
		throw new ScoreImportFatalError(
			400,
			`Invalid JSON. (${(err as Error)?.message ?? "No Error Message Available."})`
		);
	}

	return ParseBatchManualFromObject(jsonData, "file/batch-manual", logger);
}

export default ParseBatchManual;
