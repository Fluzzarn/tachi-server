import {
	EXT_BISTROVER,
	EXT_HEROIC_VERSE,
	MODEL_IIDX,
	MODEL_IIDX_LIGHTNING,
	MODEL_INFINITAS_2,
	REV_2DXTRA,
	REV_NORMAL,
	REV_OMNIMIX,
} from "lib/constants/ea3id";
import { KtLogger } from "lib/logger/logger";
import p, { PrudenceSchema, ValidSchemaValue } from "prudence";
import { ParseEA3SoftID } from "utils/ea3id";
import { FormatPrError, optNull } from "utils/prudence";
import ScoreImportFatalError from "../../../framework/score-importing/score-import-error";
import { ParserFunctionReturns } from "../../common/types";
import { FervidexContext, FervidexScore } from "./types";

const PR_Fervidex: PrudenceSchema = {
	chart: p.isIn("spb", "spn", "dpn", "sph", "dph", "spa", "dpa", "spl", "dpl"),
	entry_id: p.isPositiveInteger,
	chart_sha256: "*string",
	custom: "*boolean",

	pgreat: p.isPositiveInteger,
	great: p.isPositiveInteger,
	good: p.isPositiveInteger,
	bad: p.isPositiveInteger,
	poor: p.isPositiveInteger,

	slow: p.isPositiveInteger,
	fast: p.isPositiveInteger,
	max_combo: p.optional(p.isPositiveInteger),
	combo_break: p.isPositiveInteger,

	ex_score: p.isPositiveInteger,
	clear_type: p.isBoundedInteger(0, 7),

	gauge: [p.isBoundedInteger(0, 255)],
	ghost: [p.isBoundedInteger(0, 100)],

	dead: p.optional({
		measure: optNull(p.isPositiveInteger),
		note: optNull(p.isPositiveInteger),
	} as unknown as ValidSchemaValue),

	option: p.optional({
		gauge: optNull(p.isIn("ASSISTED_EASY", "EASY", "HARD", "EX_HARD")),
		range: optNull(
			p.isIn("SUDDEN_PLUS", "HIDDEN_PLUS", "SUD_PLUS_HID_PLUS", "LIFT", "LIFT_SUD_PLUS")
		),
		style: optNull(p.isIn("RANDOM", "R_RANDOM", "S_RANDOM", "MIRROR")),
		style_2p: optNull(p.isIn("RANDOM", "R_RANDOM", "S_RANDOM", "MIRROR")),
		assist: optNull(p.isIn("AUTO_SCRATCH", "LEGACY_NOTE", "ASCR_LEGACY", "FULL_ASSIST")),
	}),

	// we dont use it and we dont care.
	pacemaker: p.any,

	"2dx-gsm": p.optional({
		EASY: [p.isBoundedInteger(0, 255)],
		NORMAL: [p.isBoundedInteger(0, 255)],
		HARD: [p.isBoundedInteger(0, 255)],
		EX_HARD: [p.isBoundedInteger(0, 255)],
	}),
};

/**
 * Converts a string of the form LDJ:X:X:X:2020092900 into a game version.
 * I don't really understand the software model format, so this is lazy.
 */
export function SoftwareIDToVersion(model: string, logger: KtLogger) {
	try {
		const data = ParseEA3SoftID(model);

		if (data.model === MODEL_INFINITAS_2) {
			return "inf";
		} else if (data.model === MODEL_IIDX || data.model === MODEL_IIDX_LIGHTNING) {
			// pretty icky yandere-dev tier if statements, but hey
			// that's just how it works...
			if (data.ext === EXT_HEROIC_VERSE) {
				if (data.rev === REV_OMNIMIX) {
					return "27-omni";
				} else if (data.rev === REV_2DXTRA) {
					return "27-2dxtra";
				} else if (data.rev === REV_NORMAL) {
					return "27";
				}
			} else if (data.ext === EXT_BISTROVER) {
				if (data.rev === REV_OMNIMIX) {
					return "28-omni";
				} else if (data.rev === REV_2DXTRA) {
					return "28-2dxtra";
				} else if (data.rev === REV_NORMAL) {
					return "28";
				}
			}
		}

		logger.warn(`Unsupported Software Model ${model}.`);
		throw new ScoreImportFatalError(400, `Unsupported Software Model ${model}.`);
	} catch (err) {
		logger.warn(`Unsupported Software Model ${model}.`, { err });
		throw new ScoreImportFatalError(400, `Unsupported Software Model ${model}.`);
	}
}

export interface FerHeaders {
	model: string;
}

export function ParseFervidexSingle(
	body: Record<string, unknown>,
	headers: FerHeaders,
	logger: KtLogger
): ParserFunctionReturns<FervidexScore, FervidexContext> {
	const version = SoftwareIDToVersion(headers.model, logger);

	// more mods may be added in the future, so lets ignore excess keys.
	const err = p(body, PR_Fervidex, undefined, { allowExcessKeys: true });

	if (err) {
		throw new ScoreImportFatalError(400, FormatPrError(err, "Invalid Fervidex Request?"));
	}

	// asserted using prudence.
	return {
		context: { version, timeReceived: Date.now() },
		game: "iidx",
		iterable: [body] as unknown as FervidexScore[],
		classHandler: null,
	};
}
