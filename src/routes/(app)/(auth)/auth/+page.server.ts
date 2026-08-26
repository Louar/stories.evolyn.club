import { db } from '$lib/db/database';
import { acceptLatestLicense, authenticateUser } from '$lib/db/repositories/1-client-user-module';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import { fail, redirect } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { z } from 'zod/v4';
import type { Actions } from './$types';
import { schemaToAuthenticate, schemaToRegister } from './schemas';

export const actions = {
	authenticate: async ({ request, cookies, locals, url }) => {
		const formData = await request.formData();
		const values = {
			email: String(formData.get('email') ?? ''),
			password: String(formData.get('password') ?? '')
		};
		const result = schemaToAuthenticate.safeParse(values);
		if (!result.success) {
			return fail(400, {
				form: 'authenticate' as const,
				values,
				errors: z.flattenError(result.error).fieldErrors,
				message: 'Oeps, inloggen mislukt. Probeer het nog eens.'
			});
		}

		const { email, password } = result.data;

		try {
			delete locals.authusr;
			cookies.delete(process.env.NODE_ENV === 'production' ? '__session' : '__session_core', {
				domain: url.hostname,
				path: '/'
			});
			await authenticateUser(
				email,
				password,
				url.hostname,
				locals.client.id,
				locals.client.accessTokenKey,
				cookies
			);
		} catch (e) {
			return fail(400, {
				form: 'authenticate' as const,
				values,
				errors: {},
				message: e instanceof Error ? e.message : 'Oeps, inloggen mislukt. Probeer het nog eens.'
			});
		}

		let r = '/';
		if (url.searchParams.get('r')?.length) r = url.searchParams.get('r')!;
		if (locals.client.redirectAuthorized?.length) r = locals.client.redirectAuthorized;
		throw redirect(302, r);
	},
	register: async ({ request, cookies, url, locals }) => {
		const clientId = locals.client.id;
		const formData = await request.formData();
		const values = {
			email: String(formData.get('email') ?? ''),
			password: String(formData.get('password') ?? ''),
			passwordConfirm: String(formData.get('passwordConfirm') ?? ''),
			firstName: String(formData.get('firstName') ?? ''),
			lastName: String(formData.get('lastName') ?? '')
		};
		const result = schemaToRegister.safeParse(values);
		if (!result.success) {
			return fail(400, {
				form: 'register' as const,
				values,
				errors: z.flattenError(result.error).fieldErrors,
				message: 'Registration failed.'
			});
		}

		const { email, password, firstName, lastName } = result.data;

		const user = await db
			.selectFrom('user')
			.select('id')
			.where('clientId', '=', clientId)
			.where('email', '=', email)
			.executeTakeFirst();
		if (user) {
			return fail(400, {
				form: 'register' as const,
				values,
				errors: {},
				message: 'An account already exists for this email address.'
			});
		}

		const roles: UserRole[] = [UserRole.participant];
		if (
			((
				await db
					.selectFrom('user')
					.where('clientId', '=', clientId)
					.select(({ fn }) => fn.countAll().as('count'))
					.executeTakeFirst()
			)?.count || 0) === 0
		)
			roles.push(UserRole.admin);

		const salt = await bcrypt.genSalt();
		const hash = await bcrypt.hash(password, salt);

		try {
			await db.transaction().execute(async (trx) => {
				const createdUser = await trx
					.insertInto('user')
					.values({
						clientId,
						email,
						password: `{bcrypt}${hash}`,
						firstName,
						lastName,
						roles
					})
					.returning('id')
					.executeTakeFirstOrThrow();

				await acceptLatestLicense(clientId, createdUser.id, trx, false);
			});
		} catch (e) {
			return fail(400, {
				form: 'register' as const,
				values,
				errors: {},
				message: e instanceof Error ? e.message : 'Oeps, registreren mislukt. Probeer het nog eens.'
			});
		}

		// Authenticate
		try {
			await authenticateUser(
				email,
				password,
				url.hostname,
				locals.client.id,
				locals.client.accessTokenKey,
				cookies
			);
		} catch (e) {
			return fail(400, {
				form: 'register' as const,
				values,
				errors: {},
				message: e instanceof Error ? e.message : 'Oeps, registreren mislukt. Probeer het nog eens.'
			});
		}

		let r = '/';
		if (url.searchParams.get('r')?.length) r = url.searchParams.get('r')!;
		if (locals.client.redirectAuthorized?.length) r = locals.client.redirectAuthorized;
		throw redirect(302, r);
	}
} satisfies Actions;
