import { RequestHandler } from "express";

export const ValidateIRClientVersion: RequestHandler = (req, res, next) => {
	const header = req.header("X-TachiIR-Version");

	if (!header?.startsWith("v2")) {
		return res.status(400).json({
			success: false,
			description: `Invalid X-TachiIR-Version.`,
		});
	}

	return next();
};
