import { KtLogger } from "lib/logger/logger";
import { USCClientScore } from "server/router/ir/usc/_playtype/types";
import {
	BatchManualScore,
	ChartDocument,
	Game,
	ImportTypes,
	integer,
	MongoDBDocument,
	SongDocument,
} from "tachi-common";
import { EmptyObject } from "utils/types";
import { ConverterFailure } from "../../framework/common/converter-failures";
import { DryScore } from "../../framework/common/types";
import { ClassHandler } from "../../framework/user-game-stats/types";
import { SDVXEamusementCSVData } from "../file/eamusement-sdvx-csv/types";
import { MerScore } from "../file/mer-iidx/types";
import { S3Score } from "../file/solid-state-squad/types";
import { BarbatosContext, BarbatosScore } from "../ir/barbatos/types";
import { BeatorajaContext, BeatorajaScore } from "../ir/beatoraja/types";
import { FervidexStaticContext, FervidexStaticScore } from "../ir/fervidex-static/types";
import { FervidexContext, FervidexScore } from "../ir/fervidex/types";
import { KsHookSV6CContext, KsHookSV6CScore } from "../ir/kshook-sv6c/types";
import { LR2HookContext, LR2HookScore } from "../ir/lr2hook/types";
import { IRUSCContext } from "../ir/usc/types";
import { KaiContext } from "./api-kai/types";
import { BatchManualContext } from "./batch-manual/types";
import { IIDXEamusementCSVContext, IIDXEamusementCSVData } from "./eamusement-iidx-csv/types";

export interface ImportTypeDataMap {
	"file/eamusement-iidx-csv": IIDXEamusementCSVData;
	"file/eamusement-sdvx-csv": SDVXEamusementCSVData;
	"file/batch-manual": BatchManualScore;
	"file/solid-state-squad": S3Score;
	"file/mer-iidx": MerScore;
	"file/pli-iidx-csv": IIDXEamusementCSVData;

	"ir/direct-manual": BatchManualScore;
	"ir/barbatos": BarbatosScore;
	"ir/fervidex": FervidexScore;
	"ir/fervidex-static": FervidexStaticScore;
	"ir/beatoraja": BeatorajaScore;
	"ir/usc": USCClientScore;
	"ir/kshook-sv6c": KsHookSV6CScore;
	"ir/lr2hook": LR2HookScore;

	// These aren't placeholder values - the data is yielded in a way that
	// the value of these is legitimately unknown at convert time.
	"api/arc-iidx": unknown;
	"api/arc-sdvx": unknown;
	"api/flo-iidx": unknown;
	"api/flo-sdvx": unknown;
	"api/min-sdvx": unknown;
	"api/eag-iidx": unknown;
	"api/eag-sdvx": unknown;
}

export interface ImportTypeContextMap {
	"file/eamusement-iidx-csv": IIDXEamusementCSVContext;
	"file/eamusement-sdvx-csv": EmptyObject;
	"file/batch-manual": BatchManualContext;
	"file/solid-state-squad": EmptyObject;
	"file/mer-iidx": EmptyObject;
	"file/pli-iidx-csv": IIDXEamusementCSVContext;

	"ir/direct-manual": BatchManualContext;
	"ir/barbatos": BarbatosContext;
	"ir/fervidex": FervidexContext;
	"ir/fervidex-static": FervidexStaticContext;
	"ir/beatoraja": BeatorajaContext;
	"ir/usc": IRUSCContext;
	"ir/kshook-sv6c": KsHookSV6CContext;
	"ir/lr2hook": LR2HookContext;

	"api/arc-iidx": EmptyObject;
	"api/arc-sdvx": EmptyObject;
	"api/flo-iidx": KaiContext;
	"api/flo-sdvx": KaiContext;
	"api/min-sdvx": KaiContext;
	"api/eag-iidx": KaiContext;
	"api/eag-sdvx": KaiContext;
}

export interface OrphanScoreDocument<T extends ImportTypes = ImportTypes> extends MongoDBDocument {
	importType: T;
	data: ImportTypeDataMap[T];
	context: ImportTypeContextMap[T];
	errMsg: string | null;
	orphanID: string;
	userID: integer;
	timeInserted: number;
	game: Game;
}

export interface ConverterFnSuccessReturn {
	dryScore: DryScore;
	chart: ChartDocument;
	song: SongDocument;
}

export type ConverterFnReturnOrFailure = ConverterFailure | ConverterFnSuccessReturn;

export interface ConverterFunction<D, C> {
	(
		data: D,
		processContext: C,
		importType: ImportTypes,
		logger: KtLogger
	): Promise<ConverterFnSuccessReturn>;
}

export interface ImportInputParser<D, C> {
	(logger: KtLogger): ParserFunctionReturns<D, C> | Promise<ParserFunctionReturns<D, C>>;
}

export interface ParserFunctionReturns<D, C> {
	iterable: Iterable<D> | AsyncIterable<D>;
	context: C;
	game: Game;
	classHandler: ClassHandler | null;
}

export type ParserFunction<D, C, A extends unknown[]> = (...args: A) => ParserFunctionReturns<D, C>;
