import type { PropertyVisibility } from '$lib/db/schemas/2-activity-module';
import Dexie, { type EntityTable } from 'dexie';

export type LocalActivity = {
	id: string;
	template: string;
	provider: string | null;
	start: Date | null;
	end: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type LocalProperty = {
	id: string;
	activityId: string;
	template: string;
	value: Record<string, unknown> | unknown[];
	visibility: PropertyVisibility | null;
};

export type LocalTaskContribution = {
	id: string;
	skillAchievementId: string;
	skillId: string;
	skillSlug: string;
	skillName: string | null;
	taskId: string;
	taskSlug: string;
	activityId: string;
	completionPercentagePoint: number;
	createdAt: Date;
};

export type LocalSkillAchievement = {
	id: string;
	skillId: string;
	skillSlug: string;
	skillName: string | null;
	completionPercentage: number;
	updatedAt: Date;
};

export type LocalMissionEnrollment = {
	missionId: string;
	missionSlug: string;
	isEnrolled: boolean;
	updatedAt: Date;
};

export type LocalProfile = {
	id: 'profile';
	displayName: string | null;
	updatedAt: Date;
};

export type LocalActivityInput = {
	template: string;
	provider?: string | null;
	start: Date | null;
	end: Date | null;
	properties: Array<{
		template: string;
		obj: Record<string, unknown> | unknown[];
		visibility?: PropertyVisibility | null;
	}>;
};

export type PotentialContribution = {
	skillId: string;
	skillSlug: string;
	skillName: string | null;
	completionPercentagePoint: number;
};

export type LocalDatabase = Dexie & {
	activities: EntityTable<LocalActivity, 'id'>;
	properties: EntityTable<LocalProperty, 'id'>;
	taskContributions: EntityTable<LocalTaskContribution, 'id'>;
	skillAchievements: EntityTable<LocalSkillAchievement, 'id'>;
	missionEnrollments: EntityTable<LocalMissionEnrollment, 'missionId'>;
	profiles: EntityTable<LocalProfile, 'id'>;
};

const databases = new Map<string, LocalDatabase>();

export function getLocalDatabase(clientId: string): LocalDatabase {
	if (typeof indexedDB === 'undefined') throw new Error('Local storage is unavailable');

	const databaseName = `evolyn-${clientId}`;
	const existing = databases.get(databaseName);
	if (existing) return existing;

	const database = new Dexie(databaseName) as LocalDatabase;
	database.version(1).stores({
		activities: '++id, template, provider, start',
		properties: '++id, activityId, template, visibility, [activityId+template]',
		taskContributions:
			'++id, skillAchievementId, taskSlug, activityId, [skillAchievementId+taskSlug]',
		skillAchievements: '++id, skillSlug'
	});
	database.version(2).stores({
		activities: '&id, template, provider, start, end, createdAt',
		properties: '&id, activityId, template, visibility, [activityId+template]',
		taskContributions:
			'&id, skillAchievementId, skillId, skillSlug, taskId, taskSlug, activityId, createdAt, [skillAchievementId+taskSlug], [taskSlug+createdAt]',
		skillAchievements: '&id, &skillSlug, skillId, updatedAt',
		missionEnrollments: '&missionId, &missionSlug, updatedAt',
		profiles: '&id, updatedAt'
	});

	databases.set(databaseName, database);
	return database;
}

export async function saveLocalActivity(
	clientId: string,
	input: LocalActivityInput,
	options?: {
		task?: { id: string; slug: string };
		contributions?: PotentialContribution[];
	}
) {
	const database = getLocalDatabase(clientId);
	const activityId = crypto.randomUUID();
	const now = new Date();
	const contributions = options?.contributions ?? [];

	await database.transaction(
		'rw',
		[
			database.activities,
			database.properties,
			database.taskContributions,
			database.skillAchievements
		],
		async () => {
			await database.activities.add({
				id: activityId,
				template: input.template,
				provider: input.provider ?? null,
				start: input.start,
				end: input.end,
				createdAt: now,
				updatedAt: now
			});
			await database.properties.bulkAdd(
				input.properties.map((property) => ({
					id: crypto.randomUUID(),
					activityId,
					template: property.template,
					value: property.obj,
					visibility: property.visibility ?? null
				}))
			);

			if (!options?.task) return;

			for (const contribution of contributions) {
				const existing = await database.skillAchievements
					.where('skillSlug')
					.equals(contribution.skillSlug)
					.first();
				const achievementId = existing?.id ?? crypto.randomUUID();
				const completionPercentage = Math.min(
					100,
					(existing?.completionPercentage ?? 0) + contribution.completionPercentagePoint
				);

				await database.skillAchievements.put({
					id: achievementId,
					skillId: contribution.skillId,
					skillSlug: contribution.skillSlug,
					skillName: contribution.skillName,
					completionPercentage,
					updatedAt: now
				});
				await database.taskContributions.add({
					id: crypto.randomUUID(),
					skillAchievementId: achievementId,
					skillId: contribution.skillId,
					skillSlug: contribution.skillSlug,
					skillName: contribution.skillName,
					taskId: options.task.id,
					taskSlug: options.task.slug,
					activityId,
					completionPercentagePoint: contribution.completionPercentagePoint,
					createdAt: now
				});
			}
		}
	);

	return activityId;
}

export async function setLocalMissionEnrollment(
	clientId: string,
	mission: { id: string; slug: string },
	isEnrolled: boolean
) {
	await getLocalDatabase(clientId).missionEnrollments.put({
		missionId: mission.id,
		missionSlug: mission.slug,
		isEnrolled,
		updatedAt: new Date()
	});
}
