import { marked } from '$lib/client/marked';
import { db } from '$lib/db/database';
import type { Schema } from '$lib/db/schema';
import { selectLocalizedField, type Language } from '$lib/db/schemas/0-utils';
import * as m from '$lib/paraglide/messages';
import { error, type Cookies, type RequestEvent } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Kysely, Transaction } from 'kysely';

type DatabaseExecutor = Kysely<Schema> | Transaction<Schema>;

export const findOneClientByOrigin = async (origin: string) => {

	const client = await db.selectFrom('client')
		.where((eb) => eb('client.domains', '@>', eb.val([origin])))
		.select([
			'client.id',
			'client.slug',
			'client.name',
			'client.logo',
			'client.administrationEmail',
			'client.favicon',
			'client.css',
			'client.manifest',
			'client.isFindableBySearchEngines',
			'client.plausibleDomain',
			'client.authenticationMethods',
			'client.accessTokenKey',
			'client.redirectAuthorized',
			'client.redirectUnauthorized',
			'client.accessTokenKey',
		])
		.executeTakeFirst();

	if (!client) error(404, m.client_not_found());

	return client;
}

export const findOneClient = async (clientSlug: string, language?: Language) => {

	const clientRaw = await db.selectFrom('client')
		.where('client.slug', '=', clientSlug)
		.select((eb) => [
			'client.id',
			'client.slug',
			'client.name',
			'client.administrationEmail',
			'client.logo',
			selectLocalizedField(eb, 'client.description', language).as('description'),
		])
		.executeTakeFirst();

	if (!clientRaw) error(404, m.client_not_found());

	const client = { ...clientRaw, description: clientRaw.description ? await marked.parse(clientRaw.description) : null };
	return client;
}

export const findLatestLicense = async (
	clientId: string,
	language?: Language,
	executor: DatabaseExecutor = db
) =>
	executor
		.selectFrom('license')
		.where('license.clientId', '=', clientId)
		.select((eb) => [
			'license.id',
			selectLocalizedField(eb, 'license.name', language).as('name'),
			'license.version',
			'license.createdAt',
			'license.updatedAt',
			selectLocalizedField(eb, 'license.termsOfUse', language).as('termsOfUse'),
			selectLocalizedField(eb, 'license.privacyPolicy', language).as('privacyPolicy')
		])
		.orderBy('license.updatedAt', 'desc')
		.orderBy('license.id', 'desc')
		.executeTakeFirst();

export const findPolicyState = async (
	clientId: string,
	userId?: string,
	language?: Language,
	executor: DatabaseExecutor = db
) => {
	const latestLicense = await findLatestLicense(clientId, language, executor);
	if (!latestLicense || !userId) {
		return { latestLicense, latestAgreement: undefined, mostRecentAgreement: undefined };
	}

	const [latestAgreement, mostRecentAgreement] = await Promise.all([
		executor
			.selectFrom('licenseAgreement')
			.where('licenseAgreement.licenseId', '=', latestLicense.id)
			.where('licenseAgreement.userId', '=', userId)
			.where('licenseAgreement.isAccepted', '=', true)
			.select([
				'licenseAgreement.id',
				'licenseAgreement.licenseId',
				'licenseAgreement.isAccepted',
				'licenseAgreement.updatedAt as acceptedAt'
			])
			.executeTakeFirst(),
		executor
			.selectFrom('licenseAgreement')
			.innerJoin('license', 'license.id', 'licenseAgreement.licenseId')
			.where('license.clientId', '=', clientId)
			.where('licenseAgreement.userId', '=', userId)
			.where('licenseAgreement.isAccepted', '=', true)
			.select([
				'licenseAgreement.id',
				'licenseAgreement.licenseId',
				'licenseAgreement.isAccepted',
				'licenseAgreement.updatedAt as acceptedAt',
				'license.version'
			])
			.orderBy('licenseAgreement.updatedAt', 'desc')
			.orderBy('licenseAgreement.id', 'desc')
			.executeTakeFirst()
	]);

	return { latestLicense, latestAgreement, mostRecentAgreement };
};

export const acceptLatestLicense = async (
	clientId: string,
	userId: string,
	executor: DatabaseExecutor = db,
	requireLicense = true
) => {
	const user = await executor
		.selectFrom('user')
		.where('user.id', '=', userId)
		.where('user.clientId', '=', clientId)
		.select('user.id')
		.executeTakeFirst();
	const latestLicense = await findLatestLicense(clientId, undefined, executor);

	if (!user) error(404, m.user_missing());
	if (!latestLicense) {
		if (requireLicense) error(404, m.policies_unavailable_for_client());
		return undefined;
	}

	const agreement = await executor
		.insertInto('licenseAgreement')
		.values({ licenseId: latestLicense.id, userId, isAccepted: true })
		.onConflict((oc) =>
			oc.columns(['licenseId', 'userId']).doUpdateSet({
				isAccepted: true,
				updatedAt: new Date()
			})
		)
		.returning([
			'licenseAgreement.id',
			'licenseAgreement.licenseId',
			'licenseAgreement.userId',
			'licenseAgreement.isAccepted',
			'licenseAgreement.updatedAt as acceptedAt'
		])
		.executeTakeFirstOrThrow();

	return {
		license: {
			id: latestLicense.id,
			name: latestLicense.name,
			version: latestLicense.version,
			updatedAt: latestLicense.updatedAt
		},
		agreement
	};
};

export const authenticateUser = async (email: string, password: string, hostname: string, clientId: string, accessTokenKey: string, cookies: Cookies) => {
	const user = await db.selectFrom('user')
		.select([
			'user.id',
			'user.password',
			'user.isActive',
		])
		.where('user.clientId', '=', clientId)
		.where('user.email', '=', email)
		.executeTakeFirst();
	if (!user?.password || !(await bcrypt.compare(password, user.password?.replace('{bcrypt}', '')))) throw Error(m.auth_invalid_credentials());
	if (!user?.isActive) throw Error(m.auth_account_blocked());

	const payload = { id: user.id };
	const token = jwt.sign(payload, accessTokenKey, { expiresIn: '365d' });

	if (!token) throw Error(m.auth_invalid_token());
	const options = {
		expires: new Date(new Date().getTime() + (365 * 24 * 60 * 60 * 1000)),
		// sameSite: 'none' as "none",
		domain: hostname,
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
	};
	if (cookies) cookies.set(process.env.NODE_ENV === 'production' ? '__session' : '__session_core', token, options);

	return { id: user.id, token };
};


export const findOneAuthenticatedUser = async (event: RequestEvent) => {
	const { url, request, locals, cookies } = event;

	let token = cookies.get(process.env.NODE_ENV === 'production' ? '__session' : '__session_core');
	if (!token) {
		const authHeader = request.headers.get('Authorization');
		if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7);
	}
	if (!token) return undefined;

	try {
		const jwtu = jwt.verify(token, locals.client.accessTokenKey);
		if (typeof jwtu === 'string') throw new Error(m.generic_error());

		const user = await db
			.selectFrom('user')
			.where('id', '=', jwtu.id)
			.select((eb) => [
				'user.id',
				'user.email',
				'user.firstName',
				'user.lastName',
				eb.fn<string | null>('nullif', [eb.fn<string>('btrim', [eb.fn<string>('concat', ['user.firstName', eb.cast<string>(eb.val(' '), 'text'), 'user.lastName'])]), eb.val('')]).as('name'),
				eb.fn<string | null>('nullif', [eb.fn.coalesce(eb.fn<string | null>('left', ['user.firstName', eb.val(1)]), eb.fn<string>('left', ['user.lastName', eb.val(1)])), eb.val('')]).as('abbreviation'),
				'user.language',
				'user.picture',
				'user.roles',
				'user.isActive',
				eb.val(false).as('hasCompletedOnboarding'),
			])
			.executeTakeFirst();

		if (!user) throw new Error(m.user_not_found());
		if (!user.isActive) throw new Error(m.user_blocked());

		return user;
	} catch {
		cookies.delete(process.env.NODE_ENV === 'production' ? '__session' : '__session_core', { domain: url.hostname, path: '/' });
		return undefined;
	}
}


export const findOneAuthenticatedClient = async (event: RequestEvent) => {
	const { request, locals } = event;

	const clientId = locals.client?.id;
	if (!clientId) return undefined;

	let secret: string | undefined;
	let authHeader = request.headers.get('X-API-Key');
	if (authHeader?.length) secret = authHeader;
	if (!secret) {
		authHeader = request.headers.get('Authorization');
		if (authHeader?.startsWith('ApiKey ')) secret = authHeader.substring(7);
	}
	if (!secret) return undefined;

	const clientAuthorization = await db
		.selectFrom('clientApiKey')
		.where('clientApiKey.clientId', '=', clientId)
		.where('clientApiKey.secret', '=', secret)
		.select(['clientApiKey.scopes'])
		.executeTakeFirst();

	return clientAuthorization;
}
