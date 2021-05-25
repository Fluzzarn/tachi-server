/* eslint-disable @typescript-eslint/no-explicit-any */
import t from "tap";
import db from "../../../../external/mongo/db";
import { CloseAllConnections } from "../../../../test-utils/close-connections";
import mockApi from "../../../../test-utils/mock-api";
import ResetDBState from "../../../../test-utils/reset-db-state";
import deepmerge from "deepmerge";
import { PBScoreDocument } from "kamaitachi-common";

function InsertFakeUSCAuth() {
    return db["usc-auth-tokens"].insert({
        userID: 1,
        token: "foo",
    });
}

function TestAuth(url: string) {
    t.test(`Authorization Check ${url}`, async (t) => {
        const res = await mockApi.get(url).set("Authorization", "Bearer invalid");

        t.equal(res.body.statusCode, 41, "Should return 41 for nonsense token");

        const res2 = await mockApi.get(url).set("Authorization", "NOTBEARER invalid");

        t.equal(res2.body.statusCode, 40, "Should return 40 for nonsense authtype");

        const res3 = await mockApi.get(url);

        t.equal(res3.body.statusCode, 40, "Should return 40 for no auth header.");

        const res4 = await mockApi.get(url).set("Authorization", "Bearer foo invalid");

        t.equal(res4.body.statusCode, 40, "Should return 40 for nonsense header");
    });
}

t.test("GET /api/v1/ir/usc", async (t) => {
    await InsertFakeUSCAuth();

    t.beforeEach(ResetDBState);

    TestAuth("/api/v1/ir/usc");

    const res = await mockApi.get("/api/v1/ir/usc").set("Authorization", "Bearer foo");

    t.equal(res.body.statusCode, 20, "Should return 20");
    t.hasStrict(
        res.body.body,
        {
            serverName: "Kamaitachi BLACK",
            irVersion: "0.3.1-a",
        } as any,
        "Should return the right body."
    );

    t.end();
});

t.test("GET /api/v1/ir/usc/charts/:chartHash", (t) => {
    t.beforeEach(ResetDBState);
    t.beforeEach(InsertFakeUSCAuth);

    t.test("Should return 20 if the chartHash matches a chart.", async (t) => {
        const res = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH")
            .set("Authorization", "Bearer foo");

        t.equal(res.body.statusCode, 20, "Should return 20");

        t.end();
    });

    t.test("Should return 42 if the chartHash doesn't match a chart.", async (t) => {
        const res = await mockApi
            .get("/api/v1/ir/usc/charts/INVALID_HASH")
            .set("Authorization", "Bearer foo");

        t.equal(res.body.statusCode, 42, "Should return 42");

        t.end();
    });

    t.end();
});

const USC_SCORE_PB: PBScoreDocument = {
    chartID: "USC_CHART_ID",
    comments: [],
    rankingData: {
        rank: 1,
        outOf: 2,
    },
    songID: 1,
    userID: 1,
    timeAchieved: 0,
    playtype: "Single",
    game: "usc",
    highlight: false,
    composedFrom: {
        scorePB: "usc_score_pb",
        lampPB: "bar",
    },
    calculatedData: {
        rating: 0,
        lampRating: 0,
        gameSpecific: {},
    },
    isPrimary: true,
    scoreData: {
        score: 9_000_000,
        percent: 90,
        grade: "A+",
        esd: null,
        lamp: "EXCESSIVE CLEAR",
        lampIndex: 2,
        gradeIndex: 4, // idk, lazy
        hitData: {
            critical: 50,
            near: 30,
            miss: 10,
        },
        hitMeta: {
            gauge: 50,
        },
    },
};

t.test("GET /api/v1/ir/usc/:chartHash/record", (t) => {
    t.beforeEach(ResetDBState);
    t.beforeEach(InsertFakeUSCAuth);
    TestAuth("/api/v1/ir/usc/:chartHash/record");

    t.test("Should return 42 if the chartHash doesn't match a chart.", async (t) => {
        const res = await mockApi
            .get("/api/v1/ir/usc/charts/INVALID_HASH/record")
            .set("Authorization", "Bearer foo");

        t.equal(res.body.statusCode, 42, "Should return 42");

        t.end();
    });

    t.test("Should return 44 if there are no scores on the chart.", async (t) => {
        const res = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH/record")
            .set("Authorization", "Bearer foo");

        t.equal(res.body.statusCode, 44, "Should return 42");

        t.end();
    });

    t.test("Should return 20 and the Server Record.", async (t) => {
        await db["score-pbs"].insert([
            // empty deepmerge is because monk monkey-patches _id on,
            // which means this crashes if you try to re-insert this document.
            deepmerge(USC_SCORE_PB, {}),
            deepmerge(USC_SCORE_PB, { userID: 2, rankingData: { rank: 2 } }),
        ]);

        // hack for referencing
        await db.scores.insert({
            scoreID: "usc_score_pb",
            scoreMeta: { noteMod: "NORMAL", gaugeMod: "HARD" },
        } as any);

        const res = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH/record")
            .set("Authorization", "Bearer foo");

        t.equal(res.body.statusCode, 20, "Should return 20");

        t.strictSame(
            res.body.body,
            {
                score: 9_000_000,
                timestamp: 0,
                crit: 50,
                near: 30,
                error: 10,
                ranking: 1,
                lamp: 3,
                username: "test_zkldi",
                noteMod: "NORMAL",
                gaugeMod: "HARD",
            },
            "Should correctly return the right score."
        );

        t.end();
    });

    t.end();
});

t.test("GET /charts/:chartHash/leaderboard", (t) => {
    t.beforeEach(ResetDBState);
    t.beforeEach(InsertFakeUSCAuth);
    TestAuth("/api/v1/ir/usc/:chartHash/leaderboard");

    t.test("Should return 40 if mode is invalid", async (t) => {
        const res = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH/leaderboard")
            .set("Authorization", "Bearer foo");

        t.equal(res.body.statusCode, 40);

        const res2 = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH/leaderboard?mode=invalid")
            .set("Authorization", "Bearer foo");

        t.equal(res2.body.statusCode, 40);

        t.end();
    });

    t.test("Should return 40 if N is invalid", async (t) => {
        const res = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH/leaderboard?mode=best")
            .set("Authorization", "Bearer foo");

        t.equal(res.body.statusCode, 40);

        const res2 = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH/leaderboard?mode=best&n=foo")
            .set("Authorization", "Bearer foo");

        t.equal(res2.body.statusCode, 40);

        t.end();
    });

    t.test("Should return empty arr for mode = best if no scores", async (t) => {
        const res = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH/leaderboard?mode=best&n=5")
            .set("Authorization", "Bearer foo");

        t.equal(res.body.statusCode, 20);

        t.end();
    });

    t.test("Should return scorePBs for mode = best", async (t) => {
        await db["score-pbs"].insert([
            deepmerge(USC_SCORE_PB, {}),
            deepmerge(USC_SCORE_PB, {
                userID: 2,
                scoreData: {
                    score: 8_000_000,
                    percent: 80,
                },
                rankingData: { rank: 2 },
                composedFrom: { scorePB: "other_usc_score_pb" },
            }),
        ]);

        await db.users.insert({
            id: 2,
            username: "not_zkldi",
        } as any);

        await db.scores.insert([
            {
                scoreID: "usc_score_pb",
                scoreMeta: { noteMod: "NORMAL", gaugeMod: "HARD" },
            },
            {
                scoreID: "other_usc_score_pb",
                scoreMeta: { noteMod: "NORMAL", gaugeMod: "HARD" },
            },
        ] as any);

        const res = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH/leaderboard?mode=best&n=2")
            .set("Authorization", "Bearer foo");

        t.equal(res.body.statusCode, 20);
        t.strictSame(
            res.body.body,
            [
                {
                    score: 9000000,
                    timestamp: 0,
                    crit: 50,
                    near: 30,
                    error: 10,
                    ranking: 1,
                    lamp: 3,
                    username: "test_zkldi",
                    noteMod: "NORMAL",
                    gaugeMod: "HARD",
                },
                {
                    score: 8000000,
                    timestamp: 0,
                    crit: 50,
                    near: 30,
                    error: 10,
                    ranking: 2,
                    lamp: 3,
                    username: "not_zkldi",
                    noteMod: "NORMAL",
                    gaugeMod: "HARD",
                },
            ],
            "Should return the scores."
        );

        const res2 = await mockApi
            .get("/api/v1/ir/usc/charts/USC_CHART_HASH/leaderboard?mode=best&n=1")
            .set("Authorization", "Bearer foo");

        t.equal(res2.body.statusCode, 20);
        t.strictSame(
            res2.body.body,
            [
                {
                    score: 9000000,
                    timestamp: 0,
                    crit: 50,
                    near: 30,
                    error: 10,
                    ranking: 1,
                    lamp: 3,
                    username: "test_zkldi",
                    noteMod: "NORMAL",
                    gaugeMod: "HARD",
                },
            ],
            "Should return the scores dependent on N."
        );

        t.end();
    });

    t.end();
});

t.teardown(CloseAllConnections);