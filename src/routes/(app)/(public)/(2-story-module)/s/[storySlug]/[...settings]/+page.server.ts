import { findOneStoryBySlug } from '$lib/db/repositories/2-story-module';
import { Language, MediaCollection } from '$lib/db/schemas/0-utils';
import { getRoundedVideoTime, getYouTubeEmbedUrl } from '$lib/media/video';
import { cookieName, isLocale } from '$lib/paraglide/runtime';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, params }) => {
	const clientId = locals.client.id;

	const clientLocales = locals.client.locales.filter(isLocale);
	const defaultLanguage = clientLocales[0] ?? Language.English;
	const cookieLanguage = cookies.get(cookieName);
	const language =
		cookieLanguage && isLocale(cookieLanguage) && clientLocales.includes(cookieLanguage as Language)
			? (cookieLanguage as Language)
			: defaultLanguage;

	const story = await findOneStoryBySlug(clientId, params.storySlug, language);
	if (!story)
		error(
			404,
			`The story '${params.storySlug}' was not found. It may not exist, or may not be published, yet.`
		);

	const players = story?.parts?.map((part, index) => {
		const background =
			part.backgroundType === 'video' && part.background && 'source' in part.background
				? part.background
				: undefined;
		const start = getRoundedVideoTime(background?.start, background?.duration);
		const end = getRoundedVideoTime(background?.end, background?.duration);
		return {
			id: part.id,
			source:
				background?.source?.collection === MediaCollection.externals
					? {
							...background.source,
							filename: getYouTubeEmbedUrl(background.source.filename, {
								start: background.start,
								end: background.end,
								duration: background.duration
							})
						}
					: background?.source,
			thumbnail: background?.thumbnail ?? undefined,
			captions: background?.captions ?? undefined,
			start,
			end,
			playbackRate: 1,
			isInitialPart: index === 0,
			next: part.defaultNextPartId ?? undefined,
			doBuffer: index === 0,
			doPlay: false,
			doPause: false,
			doRestart: false,
			doEnd: false,
			time: 0
		};
	});

	return { story, players };
};
