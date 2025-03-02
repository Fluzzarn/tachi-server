import { ScoreDocument } from "tachi-common";
import t from "tap";

import ResetDBState from "test-utils/resets";
import { Testing511SPA, TestingIIDXSPDryScore } from "test-utils/test-data";
import { CreateScoreID, GetWithScoreID } from "./score-id";

t.test("#GetWithScoreID", async (t) => {
	await ResetDBState();

	const sc = await GetWithScoreID("TESTING_SCORE_ID");

	t.not(sc, null, "Return a score for a valid score id");

	const nl = await GetWithScoreID("INVALID SCORE ID");

	t.equal(nl, null, "Should return null for score IDs it cannot resolve");

	t.end();
});

t.test("#CreateScoreID", (t) => {
	const scoreID = CreateScoreID(1, TestingIIDXSPDryScore, Testing511SPA.chartID);

	t.match(
		scoreID,
		/^R[0-9a-f]{40}/u,
		"Should return an R followed by 40 characters of lowercase hex as scoreID."
	);

	t.not(
		scoreID,
		CreateScoreID(2, TestingIIDXSPDryScore, Testing511SPA.chartID),
		"Hash should be affected by userID."
	);

	t.equal(
		scoreID,
		CreateScoreID(1, TestingIIDXSPDryScore, Testing511SPA.chartID),
		"ScoreIDs should be consistently generatable"
	);

	// duplicate score
	const minimalScore = {
		scoreData: {
			percent: TestingIIDXSPDryScore.scoreData.percent,
			score: TestingIIDXSPDryScore.scoreData.score,
			grade: TestingIIDXSPDryScore.scoreData.grade,
			lamp: TestingIIDXSPDryScore.scoreData.lamp,
		},
	};

	t.equal(
		scoreID,
		CreateScoreID(1, minimalScore as ScoreDocument, Testing511SPA.chartID),
		"ScoreIDs should only be affected by score, percent, grade and lamp."
	);

	minimalScore.scoreData.percent = 0;

	t.not(
		scoreID,
		CreateScoreID(1, minimalScore as ScoreDocument, Testing511SPA.chartID),
		"ScoreIDs should not produce the same value if percent is different."
	);

	minimalScore.scoreData.percent = TestingIIDXSPDryScore.scoreData.percent;
	minimalScore.scoreData.score = 0;

	t.not(
		scoreID,
		CreateScoreID(1, minimalScore as ScoreDocument, Testing511SPA.chartID),
		"ScoreIDs should not produce the same value if score is different."
	);

	minimalScore.scoreData.score = TestingIIDXSPDryScore.scoreData.score;
	minimalScore.scoreData.lamp = "ASSIST CLEAR";

	t.not(
		scoreID,
		CreateScoreID(1, minimalScore as ScoreDocument, Testing511SPA.chartID),
		"ScoreIDs should not produce the same value if lamp is different."
	);

	minimalScore.scoreData.lamp = TestingIIDXSPDryScore.scoreData.lamp;
	minimalScore.scoreData.grade = "F";

	t.not(
		scoreID,
		CreateScoreID(1, minimalScore as ScoreDocument, Testing511SPA.chartID),
		"ScoreIDs should not produce the same value if grade is different."
	);

	t.end();
});
