import deepmerge from "deepmerge";
import db from "external/mongo/db";
import { KtLogger } from "lib/logger/logger";
import { EmitWebhookEvent } from "lib/webhooks/webhooks";
import { ClassDelta, Game, IDStrings, integer, Playtypes, UserGameStats } from "tachi-common";
import { GameClasses } from "tachi-common/js/game-classes";
import { ReturnClassIfGreater } from "utils/class";
import {
	CalculateChunithmColour,
	CalculateGitadoraColour,
	CalculateJubeatColour,
	CalculatePopnClass,
	CalculateSDVXClass,
	CalculateWACCAColour,
} from "./builtin-class-handlers";
import { ClassHandler, ScoreClasses } from "./types";

type ClassHandlerMap = {
	[G in Game]:
		| {
				[P in Playtypes[G]]: ClassHandler;
		  }
		| null;
};

/**
 * Describes the static class handlers for a game, I.E. ones that are
 * always meant to be called when new scores are found.
 *
 * These can be calculated without any external (i.e. user/api-provided) data.
 *
 * A good example of this would be, say, jubeat's colours - the boundaries depend entirely
 * on your profile skill level, which is known at the time this function is called.
 */
const STATIC_CLASS_HANDLERS: ClassHandlerMap = {
	iidx: null,
	bms: null,
	chunithm: {
		Single: CalculateChunithmColour,
	},
	ddr: null,
	gitadora: {
		Gita: CalculateGitadoraColour,
		Dora: CalculateGitadoraColour,
	},
	maimai: null,
	museca: null,
	popn: {
		"9B": CalculatePopnClass,
	},
	sdvx: {
		Single: CalculateSDVXClass,
	},
	usc: null,
	wacca: {
		Single: CalculateWACCAColour,
	},
	jubeat: {
		Single: CalculateJubeatColour,
	},
	pms: null,
};

/**
 * Calculates a Users' Game Stats Classes. This function is rather complex, because the reality is rather complex.
 *
 * A class is simply a hard bounded division dependent on a user. Such as a Dan or a skill level dependent on a statistic.
 * Not all services expose this information in the same way, so this function takes an async resolve function,
 * which is allowed to return its own classes. These will be merged with the classes that *we* can calculate.
 *
 * As an example, we are always able to calculate things like Gitadora's colours. We know the users' skill statistic,
 * and a colour is just between X-Y skill. However, we cannot always calculate something like IIDX's dans. Infact,
 * there's no calculation involved. We need to instead request this information from a service. For things like ARC
 * they expose this on a dedicated endpoint.
 * The custom function allows us to request that data from a custom endpoint, and merge it with things we can always
 * calculate.
 *
 * @param ratings - A users ratings. This is calculated in rating.ts, and passed via update-ugs.ts.
 * We request this because we need it for things like gitadora's skill divisions - We don't need to calculate our skill
 * statistic twice if we just request it be passed to us!
 * @param ImportTypeClassResolveFn - The Custom Resolve Function that certain import types may pass to us as a means
 * for retrieving information about a class. This returns the same thing as this function, and it is merged with the
 * defaults.
 */
export async function UpdateUGSClasses(
	game: Game,
	playtype: Playtypes[Game],
	userID: integer,
	ratings: Record<string, number>,
	ClassHandler: ClassHandler | null,
	logger: KtLogger
): Promise<ScoreClasses> {
	let classes: ScoreClasses = {};

	// @ts-expect-error This one sucks - I need to look into a better way of representing these types
	if (STATIC_CLASS_HANDLERS[game] && STATIC_CLASS_HANDLERS[game][playtype]) {
		// @ts-expect-error see above
		classes = await STATIC_CLASS_HANDLERS[game][playtype](
			game,
			playtype,
			userID,
			ratings,
			logger
		);
	}

	if (ClassHandler) {
		logger.debug(`Calling custom class handler.`);
		const customClasses = (await ClassHandler(game, playtype, userID, ratings, logger)) ?? {};

		classes = deepmerge(customClasses, classes);
	}

	return classes;
}

/**
 * Calculates the class "deltas" for this users classes.
 * This is for calculating scenarios where a users class has improved (i.e. they have gone from 9th dan to 10th dan).
 *
 * Knowing this information allows us to attach it onto the import, and also emit things on webhooks.
 * This function emits webhook events and inserts classachieved documents into the DB!**
 */
export async function ProcessClassDeltas(
	game: Game,
	playtype: Playtypes[Game],
	classes: ScoreClasses,
	userGameStats: UserGameStats | null,
	userID: integer,
	logger: KtLogger
): Promise<ClassDelta[]> {
	const deltas: ClassDelta[] = [];

	const achievementOps = [];

	for (const s in classes) {
		const classSet = s as keyof GameClasses<IDStrings>;
		const classVal = classes[classSet];

		if (classVal === undefined) {
			logger.debug(`Skipped deltaing-class ${classSet}.`);
			continue;
		}

		try {
			const isGreater = ReturnClassIfGreater(classSet, classVal, userGameStats);

			if (isGreater === false) {
				continue;
			} else {
				let delta: ClassDelta;
				if (isGreater === null) {
					delta = {
						game,
						set: classSet,
						playtype,
						old: null,
						new: classVal,
					};
				} else {
					delta = {
						game,
						set: classSet,
						playtype,
						old: userGameStats!.classes[classSet]!,
						new: classVal,
					};
				}

				EmitWebhookEvent({ type: "class-update/v1", content: { userID, ...delta } });

				achievementOps.push({
					userID,
					classSet: delta.set,
					classOldValue: delta.old,
					classValue: delta.new,
					game,
					playtype,
					timeAchieved: Date.now(),
				});

				deltas.push(delta);
			}
		} catch (err) {
			logger.error(err);
		}
	}

	await db["class-achievements"].insert(achievementOps);

	return deltas;
}
