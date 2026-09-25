import { demos, type DemoKind } from '$lib/demos/catalog';
import { createDemo } from '$lib/server/create-demo.server';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, fetch }) => {
	if (!Object.hasOwn(demos, params.kind)) {
		return json({ message: 'Unknown demo kind' }, { status: 404 });
	}
	const kind = params.kind as DemoKind;
	if (!demos[kind].some((demo) => demo.slug === params.slug)) {
		return json({ message: 'Unknown demo' }, { status: 404 });
	}
	try {
		return json(await createDemo(kind, params.slug, fetch), { status: 201 });
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Demo creation failed' },
			{ status: 500 }
		);
	}
};
