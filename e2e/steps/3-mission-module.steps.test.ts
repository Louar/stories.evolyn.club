import { expect, type APIRequestContext } from '@playwright/test';
import { Given, Then, When } from './fixtures.test';

type MissionStatus = {
	slug: string;
	milestones: Array<{
		slug: string;
		isActive: boolean;
		wasActive: boolean;
		averageCompletionPercentage: number | null;
	}>;
};

const taskActivities = {
	'daily-walk': {
		template: 'walk',
		properties: [
			{
				template: 'duration',
				obj: { value: 20, unit: 'minutes' }
			},
			{
				template: 'steps',
				obj: { value: 2500 }
			},
		]
	},
	'active-photo-check-in': {
		template: 'snapPhoto',
		properties: [
			{
				template: 'media',
				obj: {
					collection: 'externals',
					filename: 'https://api.dicebear.com/10.x/shapes/svg?seed=e2e-active-photo-check-in'
				}
			}
		]
	},
} as const;

const belowRequirementActivities = {
	'daily-walk': {
		template: 'walk',
		properties: [
			{
				template: 'duration',
				obj: { value: 10, unit: 'minutes' }
			},
			{
				template: 'steps',
				obj: { value: 1000 }
			},
		]
	},
} as const;

const getMissionStatus = async (request: APIRequestContext, missionSlug: string) => {
	const response = await request.get(`/api/me/missions/${missionSlug}`);
	expect(response.ok()).toBeTruthy();
	return await response.json() as MissionStatus;
};

const findMilestone = (mission: MissionStatus, milestoneSlug: string) => {
	const milestone = mission.milestones.find((item) => item.slug === milestoneSlug);
	expect(milestone).toBeTruthy();
	return milestone!;
};

const submitActivity = async (
	request: APIRequestContext,
	activity: { template: string; properties: Array<{ template: string; obj: Record<string, unknown> }> }
) => {
	const response = await request.post('/api/me/activities', {
		data: activity,
	});
	expect(response.ok()).toBeTruthy();
};

Given('Participant Pascal is not enrolled in any mission', async ({ request }) => {
	const response = await request.get('/api/me/missions');
	expect(response.ok()).toBeTruthy();
	const missions = await response.json() as Array<unknown>;
	expect(missions.length).toBe(0);
});

When('Participant Pascal joins the group {string}', async ({ request }, groupSlug) => {
	const response = await request.post(`/api/me/groups/${groupSlug}`);
	expect(response.ok()).toBeTruthy();
});

Given('Participant Pascal joined the mission group {string}', async ({ request }, groupSlug) => {
	const response = await request.post(`/api/me/groups/${groupSlug}`);
	expect(response.ok()).toBeTruthy();

	const missions = await request.get('/api/me/missions');
	expect(missions.ok()).toBeTruthy();
});

When('Participant Pascal completes the {string} task for the mission {string}', async ({ request }, taskSlug, _missionSlug) => {
	const activity = taskActivities[taskSlug as keyof typeof taskActivities];
	expect(activity, `No test activity is configured for task ${taskSlug}`).toBeTruthy();
	await submitActivity(request, activity);
});

When('Participant Pascal completes the {string} task for the mission {string} {int} times', async ({ request }, taskSlug, _missionSlug, count) => {
	const activity = taskActivities[taskSlug as keyof typeof taskActivities];
	expect(activity, `No test activity is configured for task ${taskSlug}`).toBeTruthy();

	for (let index = 0; index < count; index += 1) {
		await submitActivity(request, activity);
	}
});

When('Participant Pascal submits a walk below the {string} task requirement for the mission {string}', async ({ request }, taskSlug, _missionSlug) => {
	const activity = belowRequirementActivities[taskSlug as keyof typeof belowRequirementActivities];
	expect(activity, `No below-requirement test activity is configured for task ${taskSlug}`).toBeTruthy();
	await submitActivity(request, activity);
});

Then('Participant Pascal sees the mission {string} in the missions list', async ({ request }, missionSlug) => {
	const response = await request.get('/api/me/missions');
	expect(response.ok()).toBeTruthy();
	const missions = await response.json();
	expect(missions).toContainEqual(expect.objectContaining({
		slug: missionSlug,
	}));
});

Then('Participant Pascal sees the milestone {string} as active in the mission {string}', async ({ request }, milestoneSlug, missionSlug) => {
	const mission = await getMissionStatus(request, missionSlug);
	const milestone = findMilestone(mission, milestoneSlug);
	expect(milestone.isActive).toBe(true);
});

Then('Participant Pascal sees the milestone {string} as available in the mission {string}', async ({ request }, milestoneSlug, missionSlug) => {
	const mission = await getMissionStatus(request, missionSlug);
	const milestone = findMilestone(mission, milestoneSlug);
	expect(milestone.isActive || milestone.wasActive || milestone.averageCompletionPercentage !== null).toBe(true);
});

Then('Participant Pascal sees the milestone {string} as inactive in the mission {string}', async ({ request }, milestoneSlug, missionSlug) => {
	const mission = await getMissionStatus(request, missionSlug);
	const milestone = findMilestone(mission, milestoneSlug);
	expect(milestone.isActive).toBe(false);
});

Then('Participant Pascal sees the milestone {string} as locked in the mission {string}', async ({ request }, milestoneSlug, missionSlug) => {
	const mission = await getMissionStatus(request, missionSlug);
	const milestone = findMilestone(mission, milestoneSlug);
	expect(milestone.isActive).toBe(false);
	expect(milestone.wasActive).toBe(false);
	expect(milestone.averageCompletionPercentage).toBeNull();
});

Then('Participant Pascal sees the milestone {string} as achieved in the mission {string}', async ({ request }, milestoneSlug, missionSlug) => {
	const mission = await getMissionStatus(request, missionSlug);
	const milestone = findMilestone(mission, milestoneSlug);
	expect(milestone.isActive).toBe(false);
	expect(milestone.wasActive).toBe(true);
	expect(milestone.averageCompletionPercentage).toBe(100);
});

Then('Participant Pascal sees {int} percent progress for the milestone {string} in the mission {string}', async ({ request }, percentage, milestoneSlug, missionSlug) => {
	const mission = await getMissionStatus(request, missionSlug);
	const milestone = findMilestone(mission, milestoneSlug);
	expect(milestone.averageCompletionPercentage).toBe(percentage);
});

Then('Participant Pascal sees progress recorded for the milestone {string} in the mission {string}', async ({ request }, milestoneSlug, missionSlug) => {
	const mission = await getMissionStatus(request, missionSlug);
	const milestone = findMilestone(mission, milestoneSlug);
	expect(milestone.wasActive || milestone.isActive || milestone.averageCompletionPercentage !== null).toBe(true);
});

Then('Participant Pascal sees no progress recorded for the milestone {string} in the mission {string}', async ({ request }, milestoneSlug, missionSlug) => {
	const mission = await getMissionStatus(request, missionSlug);
	const milestone = findMilestone(mission, milestoneSlug);
	expect(milestone.averageCompletionPercentage).toBeNull();
});

Then('Participant Pascal sees no task progress for the milestone {string} in the mission {string}', async ({ request }, milestoneSlug, missionSlug) => {
	const mission = await getMissionStatus(request, missionSlug);
	const milestone = findMilestone(mission, milestoneSlug);
	expect(milestone.averageCompletionPercentage ?? 0).toBe(0);
});
