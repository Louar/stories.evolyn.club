import { db } from '$lib/db/database';
import { hashPasswordResetCode } from '$lib/server/password-reset.server';
import { fail } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import type { Actions, PageServerLoad } from './$types';

function clearSession({
	cookies,
	locals,
	url
}: Pick<Parameters<PageServerLoad>[0], 'cookies' | 'locals' | 'url'>) {
	delete locals.authusr;
	cookies.delete(process.env.NODE_ENV === 'production' ? '__session' : '__session_stories', {
		domain: url.hostname,
		path: '/'
	});
}

async function findResetUser(clientId: string, code: string) {
	const codeHash = await hashPasswordResetCode(code);
	return db
		.selectFrom('user')
		.where('user.clientId', '=', clientId)
		.where('user.passwordResetCode', '=', codeHash)
		.where('user.passwordResetExpiresAt', '>', new Date())
		.select('user.id')
		.executeTakeFirst();
}

export const load: PageServerLoad = async (event) => {
	clearSession(event);

	return {
		valid: Boolean(await findResetUser(event.locals.client.id, event.params.code))
	};
};

export const actions = {
	default: async (event) => {
		clearSession(event);

		const data = await event.request.formData();
		const password = data.get('password');
		const passwordConfirm = data.get('passwordConfirm');

		if (typeof password !== 'string' || password.length < 5) {
			return fail(422, { message: 'Your password must contain at least 5 characters.' });
		}
		if (password !== passwordConfirm) {
			return fail(422, { message: 'The passwords do not match.' });
		}

		const user = await findResetUser(event.locals.client.id, event.params.code);
		if (!user) return fail(410, { message: 'This password reset link is invalid or has expired.' });

		const salt = await bcrypt.genSalt();
		const hash = await bcrypt.hash(password, salt);
		const codeHash = await hashPasswordResetCode(event.params.code);
		const updated = await db
			.updateTable('user')
			.where('user.id', '=', user.id)
			.where('user.clientId', '=', event.locals.client.id)
			.where('user.passwordResetCode', '=', codeHash)
			.where('user.passwordResetExpiresAt', '>', new Date())
			.set({
				password: `{bcrypt}${hash}`,
				passwordResetCode: null,
				passwordResetExpiresAt: null,
				updatedAt: new Date(),
				updatedBy: user.id
			})
			.returning('user.id')
			.executeTakeFirst();

		if (!updated)
			return fail(410, { message: 'This password reset link is invalid or has expired.' });
		return { success: true };
	}
} satisfies Actions;
