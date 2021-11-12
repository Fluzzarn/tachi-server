import { Router } from "express";
import { GetUserWithIDGuaranteed } from "utils/user";
import { ExpressWrappedScoreImportMain } from "lib/score-import/framework/express-wrapper";
import ParseDirectManual from "lib/score-import/import-types/ir/direct-manual/parser";
import { SYMBOL_TachiAPIAuth } from "lib/constants/tachi";
import { RequirePermissions } from "server/middleware/auth";

const router: Router = Router({ mergeParams: true });

/**
 * Imports scores in ir/json:direct-manual form.
 * @name POST /ir/direct-manual/import
 */
router.post("/import", RequirePermissions("submit_score"), async (req, res) => {
	const intent = req.header("X-User-Intent");

	const responseData = await ExpressWrappedScoreImportMain(
		req[SYMBOL_TachiAPIAuth].userID!,
		!!intent,
		"ir/direct-manual",
		[req.body]
	);

	return res.status(responseData.statusCode).json(responseData.body);
});

export default router;
