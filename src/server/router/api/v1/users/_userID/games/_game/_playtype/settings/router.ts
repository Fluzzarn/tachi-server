import { Router } from "express";
import db from "external/mongo/db";
import { SYMBOL_TachiData } from "lib/constants/tachi";
import CreateLogCtx from "lib/logger/logger";
import p from "prudence";
import { RequirePermissions } from "server/middleware/auth";
import { GetGamePTConfig } from "tachi-common";
import { FormatPrError, optNull } from "utils/prudence";
import { FormatUserDoc } from "utils/user";
import { RequireAuthedAsUser } from "../../../../middleware";

const logger = CreateLogCtx(__filename);

const router: Router = Router({ mergeParams: true });

/**
 * Update your settings.
 *
 * @param - See the prudence middleware.
 *
 * @name PATCH /api/v1/users/:userID/games/:game/:playtype/settings
 */
router.patch(
	"/",
	RequireAuthedAsUser,
	RequirePermissions("customise_profile"),
	async (req, res) => {
		const user = req[SYMBOL_TachiData]!.requestedUser!;
		const game = req[SYMBOL_TachiData]!.game!;
		const playtype = req[SYMBOL_TachiData]!.playtype!;

		const gptConfig = GetGamePTConfig(game, playtype);

		const err = p(req.body, {
			preferredScoreAlg: p.optional(p.nullable(p.isIn(gptConfig.scoreRatingAlgs))),
			preferredSessionAlg: p.optional(p.nullable(p.isIn(gptConfig.sessionRatingAlgs))),
			preferredProfileAlg: p.optional(p.nullable(p.isIn(gptConfig.profileRatingAlgs))),
			// This is a pretty stupid IIFE level hack, ah well.
			gameSpecific: p.any,
			scoreBucket: optNull(p.isIn("grade", "lamp")),
		});

		if (err) {
			return res.status(400).json({
				success: false,
				description: FormatPrError(err, "Invalid game-settings."),
			});
		}

		if (req.body.gameSpecific) {
			let schema = {};

			if (game === "iidx") {
				schema = {
					display2DXTra: "boolean",
					bpiTarget: p.isBoundedInteger(0, 100),
				};
			}
			// A limitation in prudence means that validating top-level properties like this isn't
			// possible.
			// A prudence v1.0. should fix this!
			const err = p({ __: req.body.gameSpecific }, { __: p.optional(schema) }, {});

			if (err) {
				return res.status(400).json({
					success: false,
					description: FormatPrError(err, "Invalid game-settings."),
				});
			}
		}

		const updateQuery: Record<string, string> = {};

		// @warning Slightly icky dynamic prop assignment instead of copypasta.
		for (const key of ["Score", "Session", "Profile"]) {
			const k = `preferred${key}Alg`;

			if (req.body[k] !== undefined) {
				updateQuery[`preferences.${k}`] = req.body[k];
			}
		}

		if (req.body.scoreBucket !== undefined) {
			updateQuery[`preferences.scoreBucket`] = req.body.scoreBucket;
		}

		if (req.body.gameSpecific) {
			for (const key in req.body.gameSpecific) {
				updateQuery[`preferences.gameSpecific.${key}`] = req.body.gameSpecific[key];
			}
		}

		if (Object.keys(updateQuery).length === 0) {
			const settings = await db["game-settings"].findOne({
				userID: user.id,
				game,
				playtype,
			});

			return res.status(200).json({
				success: true,
				description: `Nothing has been modified, successfully.`,
				body: settings,
			});
		}

		await db["game-settings"].update(
			{
				userID: user.id,
				game,
				playtype,
			},
			{
				$set: updateQuery,
			}
		);

		const settings = await db["game-settings"].findOne({
			userID: user.id,
			game,
			playtype,
		});

		if (!settings) {
			logger.error(
				`User ${FormatUserDoc(
					user
				)} has no game-settings, but has played ${game} ${playtype}?`
			);

			return res.status(500).json({
				success: false,
				description: `An internal error has occured. Do not repeat this request.`,
			});
		}

		return res.status(200).json({
			success: true,
			description: `Updated settings.`,
			body: settings,
		});
	}
);

/**
 * Returns this user's settings.
 *
 * @name GET /api/v1/users/:userID/games/:game/:playtype/settings
 */
router.get("/", async (req, res) => {
	const user = req[SYMBOL_TachiData]!.requestedUser!;
	const game = req[SYMBOL_TachiData]!.game!;
	const playtype = req[SYMBOL_TachiData]!.playtype!;

	const settings = await db["game-settings"].findOne({
		userID: user.id,
		game,
		playtype,
	});

	return res.status(200).json({
		success: true,
		description: `Returned ${FormatUserDoc(user)}'s settings.`,
		body: settings,
	});
});

export default router;
