import { Router } from "express";
import { GetUserWithIDGuaranteed } from "../../../common/user";
import { RequireLoggedIn } from "../../../middleware/require-logged-in";
import { ExpressWrappedScoreImportMain } from "../../../score-import/framework/express-wrapper";
import { ParseBarbatosSingle } from "../../../score-import/import-types/ir/barbatos/parser";

const router: Router = Router({ mergeParams: true });

/**
 * Submits a single score document from Barbatos clients.
 * @name /api/ir/barbatos/score/submit
 */
router.post("/score/submit", RequireLoggedIn, async (req, res) => {
    const userDoc = await GetUserWithIDGuaranteed(req.session.ktchi!.userID);

    let responseData = await ExpressWrappedScoreImportMain(userDoc, true, "ir/barbatos", (logger) =>
        ParseBarbatosSingle(req.body, logger)
    );

    return res.status(responseData.statusCode).json(responseData.body);
});

export default router;