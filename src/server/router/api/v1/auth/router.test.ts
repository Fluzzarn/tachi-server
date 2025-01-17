import t from "tap";
import db from "external/mongo/db";

import mockApi from "test-utils/mock-api";
import ResetDBState from "test-utils/resets";
import { Sleep } from "utils/misc";
import { PasswordCompare } from "./auth";
import { ClearTestingRateLimitCache } from "server/middleware/rate-limiter";

t.test("POST /api/v1/auth/login", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(ClearTestingRateLimitCache);

	t.test("Should log a user in with right credentials", async (t) => {
		const res = await mockApi.post("/api/v1/auth/login").send({
			username: "test_zkldi",
			"!password": "password",
			captcha: "foo",
		});

		t.equal(res.status, 200);
		t.equal(res.body.success, true);
		t.strictSame(res.body.body, {
			userID: 1,
		});

		const cookie = res.headers["set-cookie"];

		const stat = await mockApi.get("/api/v1/status").set("Cookie", cookie);

		t.ok(stat.body.body.permissions.length > 0);

		t.end();
	});

	t.test("Should return 200 if user already logged in", async (t) => {
		const res = await mockApi.post("/api/v1/auth/login").send({
			username: "test_zkldi",
			"!password": "password",
			captcha: "foo",
		});

		const cookie = res.headers["set-cookie"];

		const res2 = await mockApi
			.post("/api/v1/auth/login")
			.send({
				username: "test_zkldi",
				"!password": "password",
				captcha: "foo",
			})
			.set("Cookie", cookie);

		// even if they have a login already going, just let them log in.
		t.equal(res2.status, 200);

		t.end();
	});

	t.test("Should return 401 if password invalid", async (t) => {
		const res = await mockApi.post("/api/v1/auth/login").send({
			username: "test_zkldi",
			"!password": "invalid_password",
			captcha: "foo",
		});

		t.equal(res.status, 401);

		t.end();
	});

	t.test("Should return 404 if user invalid", async (t) => {
		const res = await mockApi.post("/api/v1/auth/login").send({
			username: "invalid_user",
			"!password": "password",
			captcha: "foo",
		});

		t.equal(res.status, 404);

		t.end();
	});

	t.test("Should return 400 if no password", async (t) => {
		const res = await mockApi.post("/api/v1/auth/login").send({
			username: "invalid_user",
			captcha: "foo",
		});

		t.equal(res.status, 400);

		t.end();
	});

	t.test("Should return 400 if no username", async (t) => {
		const res = await mockApi.post("/api/v1/auth/login").send({
			"!password": "password",
			captcha: "foo",
		});

		t.equal(res.status, 400);

		t.end();
	});

	t.test("Should return 400 if no captcha", async (t) => {
		const res = await mockApi.post("/api/v1/auth/login").send({
			"!password": "password",
			username: "test_zkldi",
		});

		t.equal(res.status, 400);

		t.end();
	});

	t.end();
});

t.test("POST /api/v1/auth/register", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(ClearTestingRateLimitCache);

	t.beforeEach(() =>
		db.invites.insert({
			code: "code",
			createdBy: 1,
			createdAt: 0,
			consumed: false,
			consumedAt: null,
			consumedBy: null,
		})
	);

	t.test("Should register a new user.", async (t) => {
		const res = await mockApi.post("/api/v1/auth/register").send({
			username: "foo",
			"!password": "password",
			email: "foo@bar.com",
			captcha: "1",
			inviteCode: "code",
		});

		t.equal(res.statusCode, 200);
		t.equal(res.body.success, true);
		t.equal(res.body.body.username, "foo");

		const doc = await db.users.findOne({ username: "foo" });

		t.not(doc, null);

		t.end();
	});

	t.test("Should disallow users with matching names.", async (t) => {
		const res = await mockApi.post("/api/v1/auth/register").send({
			username: "test_zkldi",
			"!password": "password",
			email: "foo@bar.com",
			captcha: "1",
			inviteCode: "code",
		});

		t.equal(res.statusCode, 409);
		t.equal(res.body.success, false);

		t.end();
	});

	t.test("Should disallow users with matching names case insensitively.", async (t) => {
		const res = await mockApi.post("/api/v1/auth/register").send({
			username: "test_zKLdi",
			"!password": "password",
			email: "foo@bar.com",
			captcha: "1",
			inviteCode: "code",
		});

		t.equal(res.statusCode, 409);
		t.equal(res.body.success, false);

		t.end();
	});

	t.test("Should disallow email if it is already used.", async (t) => {
		const res = await mockApi.post("/api/v1/auth/register").send({
			username: "foo",
			"!password": "password",
			email: "thepasswordis@password.com", // this is our test docs email, apparently.
			captcha: "1",
			inviteCode: "code",
		});

		t.equal(res.statusCode, 409);
		t.equal(res.body.success, false);

		t.end();
	});

	t.test("Should disallow invalid emails.", async (t) => {
		const res = await mockApi.post("/api/v1/auth/register").send({
			username: "foo",
			"!password": "password",
			email: "nonsense+email",
			captcha: "1",
			inviteCode: "code",
		});

		t.equal(res.statusCode, 400);
		t.equal(res.body.success, false);

		t.end();
	});

	t.test("Should disallow short passwords.", async (t) => {
		const res = await mockApi.post("/api/v1/auth/register").send({
			username: "foo",
			"!password": "pass",
			email: "foo@bar.com",
			captcha: "1",
			inviteCode: "code",
		});

		t.equal(res.statusCode, 400);
		t.equal(res.body.success, false);

		t.end();
	});

	t.test("Should disallow invalid usernames.", async (t) => {
		const res = await mockApi.post("/api/v1/auth/register").send({
			username: "3foo",
			"!password": "password",
			email: "foo@bar.com",
			captcha: "1",
			inviteCode: "code",
		});

		t.equal(res.statusCode, 400);
		t.equal(res.body.success, false);

		const res2 = await mockApi.post("/api/v1/auth/register").send({
			username: "f",
			"!password": "password",
			email: "foo@bar.com",
			captcha: "1",
			inviteCode: "code",
		});

		t.equal(res2.statusCode, 400);
		t.equal(res2.body.success, false);

		t.end();
	});

	t.test("Should recover from a fatal error without breaking state.", async (t) => {
		await db.counters.update({ counterName: "users" }, { $set: { value: 1 } }); // this will cause a userID collision

		const res = await mockApi.post("/api/v1/auth/register").send({
			username: "foo",
			"!password": "password",
			email: "foo@bar.com",
			captcha: "1",
			inviteCode: "code",
		});

		t.equal(res.statusCode, 500);

		const counter = await db.counters.findOne({ counterName: "users" });

		// value should not stay incremented
		t.equal(counter?.value, 1);

		const invite = await db.invites.findOne({ code: "code" });

		// invite should not be consumed
		t.equal(invite?.consumed, false);

		t.end();
	});

	t.end();
});

t.test("POST /api/v1/auth/forgot-password", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(ClearTestingRateLimitCache);

	t.test("Should create a code to reset a password with.", async (t) => {
		const res = await mockApi.post("/api/v1/auth/forgot-password").send({
			email: "thepasswordis@password.com",
		});

		t.equal(res.statusCode, 202, "Should return 202 immediately.");

		t.strictSame(res.body.body, {}, "Should have no body.");

		// We have to wait for this operation to complete, otherwise, this isn't going to work.
		// Note that 3seconds is a bit excessive, but better safe than
		// sorry!
		await Sleep(3_000);

		const dbRes = await db["password-reset-codes"].findOne({
			userID: 1,
		});

		t.not(dbRes, null, "Should exist and save a code to the database.");

		t.end();
	});

	t.test(
		"Should not create a code to reset a password with if the email does not exist.",
		async (t) => {
			const res = await mockApi.post("/api/v1/auth/forgot-password").send({
				email: "bademail@example.com",
			});

			t.equal(res.statusCode, 202, "Should return 202 immediately.");

			t.strictSame(res.body.body, {}, "Should have no body.");

			await Sleep(3_000);

			const dbRes = await db["password-reset-codes"].findOne({
				userID: 1,
			});

			t.equal(dbRes, null, "Should not bother sending a code to the database.");

			t.end();
		}
	);

	t.end();
});

t.test("POST /api/v1/auth/reset-password", (t) => {
	t.beforeEach(ResetDBState);
	t.beforeEach(ClearTestingRateLimitCache);

	t.test("Should reset a users password if they have a valid code.", async (t) => {
		await db["password-reset-codes"].insert({
			code: "SECRET_CODE",
			createdOn: Date.now(),
			userID: 1,
		});

		const res = await mockApi.post("/api/v1/auth/reset-password").send({
			code: "SECRET_CODE",
			"!password": "newpassword",
		});

		t.equal(res.statusCode, 200);

		const dbRes = await db["password-reset-codes"].findOne({
			code: "SECRET_CODE",
		});

		t.equal(dbRes, null, "Codes MUST be destroyed after use.");

		const privateInfo = await db["user-private-information"].findOne({
			userID: 1,
		});

		t.ok(
			await PasswordCompare("newpassword", privateInfo!.password),
			"Password must be updated to 'newpassword'"
		);

		t.end();
	});

	t.end();
});
