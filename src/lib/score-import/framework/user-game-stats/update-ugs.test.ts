import crypto from "crypto";
import deepmerge from "deepmerge";
import db from "external/mongo/db";
import CreateLogCtx from "lib/logger/logger";
import t from "tap";
import ResetDBState from "test-utils/resets";
import { TestingIIDXSPScorePB } from "test-utils/test-data";
import { UpdateUsersGamePlaytypeStats } from "./update-ugs";

const logger = CreateLogCtx(__filename);

// more of an integration test
t.test("#UpdateUsersGamePlaytypeStats", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(async () => {
		delete TestingIIDXSPScorePB._id;
		await db["personal-bests"].insert(TestingIIDXSPScorePB);
	});

	t.test(
		"Should create new UserGameStats and UserGameSettings if the user has none",
		async (t) => {
			await db["game-stats"].remove({});
			await db["game-settings"].remove({});

			const res = await UpdateUsersGamePlaytypeStats("iidx", "SP", 1, null, logger);

			t.strictSame(res, [], "Should return an empty object");

			const gs = await db["game-stats"].findOne();

			t.hasStrict(
				gs,
				{
					game: "iidx",
					playtype: "SP",
					userID: 1,
					ratings: { ktLampRating: 0 },
					classes: {},
				},
				"Should insert an appropriate game-stats object"
			);

			const settings = await db["game-settings"].findOne();

			t.hasStrict(settings, {
				game: "iidx",
				playtype: "SP",
				userID: 1,
				preferences: {},
			});

			t.end();
		}
	);

	t.test("Should update UserGameStats if the user has one", async (t) => {
		await db["game-stats"].remove({});

		await db["game-stats"].insert({
			game: "iidx",
			playtype: "SP",
			userID: 1,
			ratings: { ktLampRating: 0 },
			classes: {},
		});

		// insert some mock scores
		const ratings = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

		await db["personal-bests"].insert(
			ratings.map((e) =>
				deepmerge(TestingIIDXSPScorePB, {
					chartID: crypto.randomBytes(20).toString("hex"),
					calculatedData: {
						ktLampRating: e,
					},
				})
			)
		);

		const res = await UpdateUsersGamePlaytypeStats("iidx", "SP", 1, null, logger);

		t.strictSame(res, [], "Should return an empty object");

		const gs = await db["game-stats"].findOne();

		t.hasStrict(
			gs,
			{
				game: "iidx",
				playtype: "SP",
				userID: 1,
				ratings: { ktLampRating: ratings.reduce((a, e) => a + e, 0) / 20 },
				classes: {},
			},
			"Should update the game-stats object"
		);

		t.end();
	});

	t.test("Should return class deltas", async (t) => {
		await db["game-stats"].remove({});

		await db["game-stats"].insert({
			game: "iidx",
			playtype: "SP",
			userID: 1,
			ratings: { ktLampRating: 0 },

			classes: {},
		});

		const res = await UpdateUsersGamePlaytypeStats(
			"iidx",
			"SP",
			1,
			() => ({ dan: 18 }), // lmao
			logger
		);

		t.strictSame(
			res,
			[
				{
					game: "iidx",
					set: "dan",
					playtype: "SP",
					old: null,
					new: 18,
				},
			],
			"Should return the class delta"
		);

		const gs = await db["game-stats"].findOne();

		t.hasStrict(
			gs,
			{
				game: "iidx",
				playtype: "SP",
				userID: 1,
				ratings: { ktLampRating: 0 },
				classes: {
					dan: 18,
				},
			},
			"Should update the game-stats object"
		);

		t.end();
	});

	t.test("Should return updated class deltas", async (t) => {
		await db["game-stats"].remove({});

		await db["game-stats"].insert({
			game: "iidx",
			playtype: "SP",
			userID: 1,
			ratings: { ktLampRating: 0 },
			classes: {
				dan: 17,
			},
		});

		const res = await UpdateUsersGamePlaytypeStats(
			"iidx",
			"SP",
			1,
			() => ({ dan: 18 }), // lmao
			logger
		);

		t.strictSame(
			res,
			[
				{
					game: "iidx",
					set: "dan",
					playtype: "SP",
					old: 17,
					new: 18,
				},
			],
			"Should return the updated class delta"
		);

		const gs = await db["game-stats"].findOne();

		t.hasStrict(
			gs,
			{
				game: "iidx",
				playtype: "SP",
				userID: 1,
				ratings: { ktLampRating: 0 },
				classes: {
					dan: 18,
				},
			},
			"Should update the game-stats object"
		);

		t.end();
	});

	t.end();
});
