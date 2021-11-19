import { KtLogger } from "lib/logger/logger";
import { CSVParseError, NaiveCSVParse } from "utils/naive-csv-parser";
import { EmptyObject } from "utils/types";
import ScoreImportFatalError from "../../../framework/score-importing/score-import-error";
import { ParserFunctionReturns } from "../../common/types";
import { SDVXEamusementCSVData } from "./types";

const HEADER_COUNT = 11;

export default function ParseEamusementSDVXCSV(
	fileData: Express.Multer.File,
	_body: Record<string, unknown>,
	logger: KtLogger
): ParserFunctionReturns<SDVXEamusementCSVData, EmptyObject> {
	let rawHeaders: string[];
	let rawRows: string[][];
	try {
		({ rawHeaders, rawRows } = NaiveCSVParse(fileData.buffer, logger));
	} catch (e) {
		if (e instanceof CSVParseError) {
			throw new ScoreImportFatalError(400, e.message);
		}
		throw e;
	}

	if (rawHeaders.length !== HEADER_COUNT) {
		logger.info(`Invalid CSV header count of ${rawHeaders.length} received.`);
		throw new ScoreImportFatalError(
			400,
			"Invalid CSV provided. CSV does not have the correct number of headers."
		);
	}

	const iterable = rawRows.map((cells) => ({
		title: cells[0],
		difficulty: cells[1],
		level: cells[2],
		lamp: cells[3],
		score: cells[5],
		// @todo exscore is currently unused, but we should eventually store it.
		// It is 0 if the score was played without S-criticals.
		exscore: cells[6],
		// The other columns (grade, # of different clears) are essentially useless.
		// There is no timestamp 😢
	}));

	return {
		iterable,
		context: {},
		game: "sdvx",
		classHandler: null,
	};
}
