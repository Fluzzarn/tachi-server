import { ClearTestingRateLimitCache } from "server/middleware/rate-limiter";
import t from "tap";
import mockApi from "test-utils/mock-api";

// just a rudimentary test for rate-limiting. We fire 150 requests at GET /api/v1
// (which does a server status check)
// and then check any of them return 429.
t.test("Rate Limiting Test", async (t) => {
	ClearTestingRateLimitCache();

	const promises = [];

	// default rate limit is 500, so lets go a bit over
	for (let i = 0; i < 520; i++) {
		promises.push(mockApi.get("/api/v1/status"));
	}

	const res = await Promise.all(promises);

	const rateLimited = res.filter((e) => e.statusCode === 429);

	t.ok(rateLimited.length > 0, "Some requests should be rate limited.");

	t.end();
});

t.test("404 Handler", async (t) => {
	ClearTestingRateLimitCache();

	const res = await mockApi.get("/api/v1/invalid_route_that_will_never_exist");

	t.equal(res.statusCode, 404);
	t.strictSame(res.body, {
		success: false,
		description: "Endpoint Not Found.",
	});

	t.end();
});
