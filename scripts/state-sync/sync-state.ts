import CreateLogCtx from "lib/logger/logger";
import { RecalcAllScores, UpdateAllPBs } from "utils/calculations/recalc-scores";
import { RecalcSessions } from "utils/calculations/recalc-sessions";
import { CreateGameProfiles } from "./create-game-profiles";

const logger = CreateLogCtx(__filename);

(async () => {
	await RecalcAllScores();
	await UpdateAllPBs();
	await CreateGameProfiles();
	await RecalcSessions();

	logger.info(`Completely done!`);
	process.exit(0);
})();
