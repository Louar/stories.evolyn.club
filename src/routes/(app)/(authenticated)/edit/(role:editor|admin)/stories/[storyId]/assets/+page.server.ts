import { db } from '$lib/db/database';
import { formatDuration, selectLocalizedField } from '$lib/db/schemas/0-utils';
import type { PageServerLoad } from './$types';

export type AssetRow =
	| {
		id: string;
		type: 'video';
		asset: string;
		name: string;
		duration: number;
	}
	| {
		id: string;
		type: 'announcement';
		asset: string;
		name: string;
	}
	| {
		id: string;
		type: 'quiz';
		asset: string;
		name: string;
		questions: number | null;
	};

const partitionStoryAssets = (rows: AssetRow[]) => {
	const videos: Extract<AssetRow, { type: 'video' }>[] = [];
	const announcements: Extract<AssetRow, { type: 'announcement' }>[] = [];
	const quizzes: Extract<AssetRow, { type: 'quiz' }>[] = [];

	for (const row of rows) {
		switch (row.type) {
			case 'video':
				videos.push(row);
				break;
			case 'announcement':
				announcements.push(row);
				break;
			case 'quiz':
				quizzes.push(row);
				break;
		}
	}

	return { videos, announcements, quizzes };
};

const partitionAvailableAssets = (rows: AssetRow[]) => {
	const allAvailableVideos: (Extract<AssetRow, { type: 'video' }> & { title: string; summary: string })[] = [];
	const allAvailableAnnouncementTemplates: (Extract<AssetRow, { type: 'announcement' }> & { title: string; summary: null })[] = [];
	const allAvailableQuizTemplates: (Extract<AssetRow, { type: 'quiz' }> & { title: string; summary: string })[] = [];

	for (const asset of rows) {
		switch (asset.type) {
			case 'video':
				allAvailableVideos.push({
					...asset,
					title: asset.name,
					summary: formatDuration(asset.duration),
				});
				break;

			case 'announcement':
				allAvailableAnnouncementTemplates.push({
					...asset,
					title: asset.name,
					summary: null,
				});
				break;

			case 'quiz':
				allAvailableQuizTemplates.push({
					...asset,
					title: asset.name,
					summary: `${asset.questions} questions`,
				});
				break;
		}
	}

	return { allAvailableVideos, allAvailableAnnouncementTemplates, allAvailableQuizTemplates };
};

export const load: PageServerLoad = async ({ locals, params, fetch }) => {
	const clientId = locals.client.id;
	const language = locals.authusr!.language;
	const storyId = params.storyId;

	const story = await db
		.selectFrom('story')
		.where('story.clientId', '=', clientId)
		.where('story.id', '=', storyId)
		.select((eb) => [
			'story.id',
			'story.reference',
			selectLocalizedField(eb, 'story.name', language).as('name'),
			'story.isPublished',
			'story.isPublic',
		])
		.executeTakeFirstOrThrow();

	// 2 requests total
	const [storyAssetsRes, availableAssetsRes] = await Promise.all([
		fetch(`/api/stories/${storyId}/assets`),
		fetch(`/api/stories/-/assets`),
	]);

	// Story assets (all types in one response)
	const storyAssets: AssetRow[] = storyAssetsRes.ok ? ((await storyAssetsRes.json()) as AssetRow[]) : [];
	const assets = partitionStoryAssets(storyAssets);

	// Available assets (note: your endpoint sometimes returns an object when no permitted stories)
	let availableAssets: AssetRow[] = [];
	if (availableAssetsRes.ok) {
		const payload = (await availableAssetsRes.json()) as AssetRow[] | { items: AssetRow[] };

		availableAssets = Array.isArray(payload) ? payload : payload.items ?? [];
	}
	const relations = partitionAvailableAssets(availableAssets);

	return {
		story,
		assets,
		relations,
	};
};