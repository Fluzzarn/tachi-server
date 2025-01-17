import t from "tap";
import db from "external/mongo/db";
import mockApi from "test-utils/mock-api";
import ResetDBState from "test-utils/resets";
import deepmerge from "deepmerge";
import { FolderDocument } from "tachi-common";

import { Testing511SPA } from "test-utils/test-data";
import { CreateFolderChartLookup } from "utils/folder";

const mockFolder: FolderDocument = {
	folderID: "foo",
	game: "iidx",
	playtype: "SP",
	title: "12",
	data: {
		level: "10",
	},
	type: "charts",
	searchTerms: [],
	inactive: false,
};

t.test("GET /api/v1/games/:game/:playtype/folders", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should search the folders for this game.", async (t) => {
		await db.folders.insert([
			deepmerge(mockFolder, {}),
			deepmerge(mockFolder, { folderID: "bar", playtype: "DP" }),
			deepmerge(mockFolder, { folderID: "baz", game: "bms" }),
		]);

		const res = await mockApi.get("/api/v1/games/iidx/SP/folders?search=12");

		t.equal(res.body.body.length, 1);
		t.equal(res.body.body[0].folderID, "foo");

		t.end();
	});

	t.test("Should return 400 if no search parameter is given.", async (t) => {
		const res = await mockApi.get("/api/v1/games/iidx/SP/folders");

		t.equal(res.statusCode, 400);

		t.end();
	});

	t.end();
});

t.test("GET /api/v1/games/:game/:playtype/folders/:folderID", (t) => {
	t.beforeEach(ResetDBState);

	t.test("Should return the folder at this ID.", async (t) => {
		await db.folders.insert(deepmerge(mockFolder, {}));
		await CreateFolderChartLookup(mockFolder);

		const res = await mockApi.get("/api/v1/games/iidx/SP/folders/foo");

		t.equal(res.body.body.folder.folderID, "foo");
		t.equal(res.body.body.songs.length, 1);
		t.equal(res.body.body.charts.length, 1);
		t.equal(res.body.body.songs[0].id, 1);
		t.equal(res.body.body.charts[0].chartID, Testing511SPA.chartID);

		t.end();
	});

	t.test("Should return 404 if the folder does not exist.", async (t) => {
		const res = await mockApi.get("/api/v1/games/iidx/SP/folders/bar");

		t.equal(res.statusCode, 404);

		t.end();
	});

	t.end();
});
