import { Router } from "express";
import db from "external/mongo/db";
import { CDNStoreOrOverwrite, CDNRedirect, CDNDelete } from "lib/cdn/cdn";
import { GetProfilePictureURL } from "lib/cdn/url-format";
import { ONE_MEGABYTE } from "lib/constants/filesize";
import { SYMBOL_TachiData } from "lib/constants/tachi";
import CreateLogCtx from "lib/logger/logger";
import { FormatUserDoc } from "utils/user";
import { RequirePermissions } from "server/middleware/auth";
import { CreateMulterSingleUploadMiddleware } from "server/middleware/multer-upload";
import { RequireAuthedAsUser } from "../middleware";

const logger = CreateLogCtx(__filename);

const router: Router = Router({ mergeParams: true });

/**
 * Sets a profile picture.
 *
 * @param pfp - A JPG or PNG file less than 1mb.
 *
 * @name PUT /api/v1/users/:userID/pfp
 */
router.put(
	"/",
	RequireAuthedAsUser,
	RequirePermissions("customise_profile"),
	CreateMulterSingleUploadMiddleware("pfp", ONE_MEGABYTE, logger),
	async (req, res) => {
		const user = req[SYMBOL_TachiData]!.requestedUser!;

		let updatePfp = false;

		if (!user.customPfp) {
			logger.verbose(`User ${FormatUserDoc(user)} set a custom profile picture.`);
			updatePfp = true;
		} else {
			logger.verbose(`User ${FormatUserDoc(user)} updated their profile picture.`);
		}

		if (!req.file) {
			logger.error(
				`Conflicting state - no req.file has been populated but passed middleware? (${FormatUserDoc(
					user
				)})`
			);
			return res.status(500).json({
				success: false,
				description: `An internal error has occured.`,
			});
		}

		if (
			req.file.mimetype === "image/jpeg" ||
			req.file.mimetype === "image/png" ||
			req.file.mimetype === "image/gif"
		) {
			await CDNStoreOrOverwrite(GetProfilePictureURL(user.id), req.file.buffer);
		} else {
			return res.status(400).json({
				success: false,
				description: `Invalid file - only JPG and PNG files are supported.`,
			});
		}

		if (updatePfp) {
			await db.users.update({ id: user.id }, { $set: { customPfp: true } });
		}

		return res.status(200).json({
			success: true,
			description: `Stored profile picture.`,
			body: {
				get: req.originalUrl,
			},
		});
	}
);

/**
 * Returns this user's profile picture. If the user does not have a custom profile picture,
 * return the default profile picture.
 *
 * @name GET /api/v1/users/:userID/pfp
 */
router.get("/", (req, res) => {
	const user = req[SYMBOL_TachiData]!.requestedUser!;

	logger.debug("User Info for /:userID/pfp request is ", user);

	if (!user.customPfp) {
		res.setHeader("Content-Type", "image/png");
		return CDNRedirect(res, "/users/default/pfp");
	}

	return CDNRedirect(res, GetProfilePictureURL(user.id));
});

/**
 * Deletes this user's profile picture, and go back to the default profile picture.
 *
 * @name DELETE /api/v1/users/:userID/pfp
 */
router.delete(
	"/",
	RequireAuthedAsUser,
	RequirePermissions("customise_profile"),
	async (req, res) => {
		const user = req[SYMBOL_TachiData]!.requestedUser!;

		if (!user.customPfp) {
			return res.status(404).json({
				success: false,
				description: `You do not have a custom profile picture to delete.`,
			});
		}

		await CDNDelete(GetProfilePictureURL(user.id));

		await db.users.update({ id: user.id }, { $set: { customPfp: false } });

		return res.status(200).json({
			success: true,
			description: `Removed custom profile picture.`,
			body: {},
		});
	}
);

export default router;
