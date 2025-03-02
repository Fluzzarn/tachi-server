import t from "tap";
import { CreateSessionCalcData } from "./calculated-data";

function ratingwrap(ratings: [number, number][]) {
	return ratings.map((e) => ({
		calculatedData: {
			BPI: e[0],
			ktLampRating: e[1],
		},
	}));
}

function avgbest10(arr: number[]) {
	return (
		arr
			.sort((a, b) => b - a)
			.slice(0, 10)
			.reduce((a, e) => a + e, 0) / 10
	);
}

t.test("#CreateSessionCalcData", (t) => {
	t.test("Should return null if less than 10 scores", (t) => {
		const res = CreateSessionCalcData("iidx", "SP", ratingwrap([[1, 2]]));

		t.strictSame(res, { BPI: null, ktLampRating: null });

		t.end();
	});

	t.test("Should calculate session performance", (t) => {
		const { BPI, ktLampRating } = CreateSessionCalcData(
			"iidx",
			"SP",
			ratingwrap([
				[1, 1],
				[2, 2],
				[3, 4],
				[4, 4],
				[6, 1],
				[1, 6],
				[1, 1],
				[2, 2],
				[3, 4],
				[4, 4],
				[6, 1],
				[1, 6],
			])
		);

		t.equal(
			ktLampRating,
			avgbest10([1, 2, 4, 4, 1, 6, 1, 2, 4, 4, 1, 6]),
			"Should correctly calculate lamp performance"
		);

		t.equal(
			BPI,
			avgbest10([1, 2, 3, 4, 6, 1, 1, 2, 3, 4, 6, 1]),
			"Should correctly calculate BPI performance"
		);

		t.end();
	});

	t.end();
});
