import type { findOneStoryById } from '$lib/db/repositories/2-story-module';

type StoryForIo = Awaited<ReturnType<typeof findOneStoryById>>;

export const serializeStoryForIo = (story: StoryForIo) => ({
	...story,
	parts: story.parts.map((part) => {
		const draft = part.taxonomyDraftForPart;
		if (!draft) return part;

		const attributeSlugById = new Map(
			(draft.attributeOptions ?? []).map((attribute) => [attribute.id, attribute.slug])
		);
		const { draftedAttributeIds, ...restDraft } = draft;

		return {
			...part,
			taxonomyDraftForPart: {
				...restDraft,
				draftedAttributeSlugs: (draftedAttributeIds ?? [])
					.map((attributeId) => attributeSlugById.get(attributeId))
					.filter((slug): slug is string => !!slug)
			}
		};
	})
});
