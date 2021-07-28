import t from "tap";
import { CloseAllConnections } from "test-utils/close-connections";
import { MockJSONFetch } from "test-utils/mock-fetch";
import ResetDBState from "test-utils/resets";
import { IIDXClasses } from "lib/constants/classes";
import CreateLogCtx from "lib/logger/logger";
import { CreateArcIIDXClassHandler } from "./class-handler";

const logger = CreateLogCtx(__filename);

t.test("#CreateArcIIDXClassHandler", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should return a working ClassHandler.", async (t) => {
		const mockFetch = MockJSONFetch({
			"https://arc.example.com/api/v1/iidx/27/profiles?_id=profile": {
				_items: [
					{
						sp: {
							rank: "中伝",
						},
						dp: {
							rank: "ニ段",
						},
					},
				],
			},
		});

		const fn = await CreateArcIIDXClassHandler("profile", "token", mockFetch);

		t.equal(fn.length, 5);

		// its not async but typescript complains
		const res = await fn("iidx", "SP", 1, {}, logger);

		t.equal(res!.dan, IIDXClasses.CHUUDEN);

		const res2 = await fn("iidx", "DP", 1, {}, logger);
		t.equal(res2!.dan, IIDXClasses.DAN_2);

		t.end();
	});

	t.test("Should handle null.", async (t) => {
		const mockFetch = MockJSONFetch({
			"https://arc.example.com/api/v1/iidx/27/profiles?_id=profile": {
				_items: [
					{
						sp: {
							rank: null,
						},
						dp: {
							rank: null,
						},
					},
				],
			},
		});

		const fn = await CreateArcIIDXClassHandler("profile", "token", mockFetch);

		t.equal(fn.length, 5);

		const res = await fn("iidx", "SP", 1, {}, logger);

		t.strictSame(res, {});

		const res2 = await fn("iidx", "DP", 1, {}, logger);
		t.strictSame(res2, {});

		t.end();
	});

	t.test("Should handle undefined.", async (t) => {
		const mockFetch = MockJSONFetch({
			"https://arc.example.com/api/v1/iidx/27/profiles?_id=profile": {
				_items: [{}],
			},
		});

		const fn = await CreateArcIIDXClassHandler("profile", "token", mockFetch);

		t.equal(fn.length, 5);

		const res = await fn("iidx", "SP", 1, {}, logger);

		t.strictSame(res, {});

		const res2 = await fn("iidx", "DP", 1, {}, logger);
		t.strictSame(res2, {});

		t.end();
	});

	t.test("Should handle invalid classes.", async (t) => {
		const mockFetch = MockJSONFetch({
			"https://arc.example.com/api/v1/iidx/27/profiles?_id=profile": {
				_items: [
					{
						sp: {
							rank: "invalid",
						},
					},
				],
			},
		});

		const fn = await CreateArcIIDXClassHandler("profile", "token", mockFetch);

		t.equal(fn.length, 5);

		const res = await fn("iidx", "SP", 1, {}, logger);

		t.strictSame(res, {});

		t.end();
	});

	t.test("Should trigger failsafe if invalid playtype is used.", async (t) => {
		const mockFetch = MockJSONFetch({
			"https://arc.example.com/api/v1/iidx/27/profiles?_id=profile": {
				_items: [
					{
						sp: {
							rank: "中伝",
						},
					},
				],
			},
		});

		const fn = await CreateArcIIDXClassHandler("profile", "token", mockFetch);

		t.equal(fn.length, 5);

		const res = await fn("iidx", "14K", 1, {}, logger);

		t.strictSame(res, {});

		t.end();
	});

	t.end();
});

t.teardown(CloseAllConnections);
