import { UserGameStats } from "tachi-common";
import t from "tap";
import CreateLogCtx from "../../../logger/logger";
import ResetDBState from "../../../../test-utils/resets";
import { CalculateClassDeltas, UpdateUGSClasses } from "./classes";
import { CloseAllConnections } from "../../../../test-utils/close-connections";
import { GitadoraColours } from "../../../constants/classes";

const logger = CreateLogCtx(__filename);

t.test("#UpdateUGSClasses", (t) => {
	t.test("Should produce an empty object by default", async (t) => {
		const res = await UpdateUGSClasses("iidx", "SP", 1, {}, null, logger);

		t.strictSame(res, {});

		t.end();
	});

	t.test("Should call and merge the ClassHandler", async (t) => {
		const res = await UpdateUGSClasses("iidx", "SP", 1, {}, () => ({ dan: 2 }), logger);

		t.strictSame(res, { dan: 2 });

		t.end();
	});

	t.test("Should call static handlers if there is one", async (t) => {
		const res = await UpdateUGSClasses(
			"gitadora",
			"Dora",
			1,
			{
				skill: 9000,
			},
			null,
			logger
		);

		t.strictSame(res, { colour: GitadoraColours.RAINBOW });

		t.end();
	});

	t.end();
});

t.test("#CalculateClassDeltas", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should return improved classes from null", (t) => {
		const res = CalculateClassDeltas("SP", { dan: 18 }, null, 1, logger);

		t.strictSame(res, [
			{
				set: "dan",
				playtype: "SP",
				old: null,
				new: 18,
			},
		]);

		t.end();
	});

	t.test("Should return improved classes from null class", (t) => {
		const res = CalculateClassDeltas(
			"SP",
			{ dan: 18 },
			{ classes: {} } as UserGameStats,
			1,
			logger
		);

		t.strictSame(res, [
			{
				set: "dan",
				playtype: "SP",
				old: null,
				new: 18,
			},
		]);

		t.end();
	});

	t.test("Should return improved classes", (t) => {
		const res = CalculateClassDeltas(
			"SP",
			{ dan: 18 },
			{ classes: { dan: 17 } } as unknown as UserGameStats,
			1,
			logger
		);

		t.strictSame(res, [
			{
				set: "dan",
				playtype: "SP",
				old: 17,
				new: 18,
			},
		]);

		t.end();
	});

	t.test("Should not return identical classes", (t) => {
		const res = CalculateClassDeltas(
			"SP",
			{ dan: 18 },
			{ classes: { dan: 18 } } as unknown as UserGameStats,
			1,
			logger
		);

		t.strictSame(res, []);

		t.end();
	});

	t.test("Should not return worse classes", (t) => {
		const res = CalculateClassDeltas(
			"SP",
			{ dan: 16 },
			{ classes: { dan: 18 } } as unknown as UserGameStats,
			1,
			logger
		);

		t.strictSame(res, []);

		t.end();
	});

	t.end();
});

t.teardown(CloseAllConnections);
