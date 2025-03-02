import crypto from "crypto";
import deepmerge from "deepmerge";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import t from "tap";
import ResetDBState from "test-utils/resets";
import { Testing511SPA, TestingIIDXSPScore } from "test-utils/test-data";
import { ProcessPBs } from "./process-pbs";

const logger = CreateLogCtx(__filename);

t.test("#ProcessPBs", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should successfully insert a pb into the score-pb database", async (t) => {
		await db["personal-bests"].remove({});

		// scores on 511 SPA are pre-loaded into the database
		await ProcessPBs(1, new Set([Testing511SPA.chartID]), logger);

		const pbs = await db["personal-bests"].find({});

		t.equal(pbs.length, 1, "Should match the amount of PBs inserted into the DB.");

		t.end();
	});

	t.test("Should successfully insert multiple pbs into the score-pb database", async (t) => {
		await db["personal-bests"].remove({});

		await db.scores.insert([
			// @ts-expect-error lol
			deepmerge(TestingIIDXSPScore, {
				chartID: "test1",
				scoreID: crypto.randomBytes(20).toString("hex"),
			}),
			// @ts-expect-error lol
			deepmerge(TestingIIDXSPScore, {
				chartID: "test2",
				scoreID: crypto.randomBytes(20).toString("hex"),
			}),
			// @ts-expect-error lol
			deepmerge(TestingIIDXSPScore, {
				chartID: "test3",
				scoreID: crypto.randomBytes(20).toString("hex"),
			}),
		]);

		await ProcessPBs(1, new Set([Testing511SPA.chartID, "test1", "test2", "test3"]), logger);

		const pbs = await db["personal-bests"].find({});

		t.equal(pbs.length, 4, "Should match the amount of PBs inserted into the DB.");

		t.end();
	});

	t.end();
});
