import { DEFAULT_CLIENT_SLUG } from '$app/env/private';
import { createDemoStories } from '$lib/db/migrations/1-dummy-data/2-demo-stories';
import {
	findOneAuthenticatedClient,
	findOneAuthenticatedUser,
	findOneClientByOrigin
} from '$lib/db/repositories/1-client-user-module';
import { Language } from '$lib/db/schemas/0-utils';
import { ClientAuthenticationMethod, UserRole } from '$lib/db/schemas/1-client-user-module';
import * as m from '$lib/paraglide/messages';
import { getLocale, getTextDirection, isLocale, setLocale } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { error, json, redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const ALLOWED_ROLES = new Set<string>([...Object.values(UserRole), 'client']);

const handleAuthorization: Handle = async ({ event, resolve }) => {
	const isApiRoute = event.url.pathname === '/api' || event.url.pathname.startsWith('/api/');

	const corsHeaders = new Headers({
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
		'Access-Control-Max-Age': '86400'
	});
	const withCors = (response: Response) => {
		const headers = new Headers(response.headers);
		for (const [name, value] of corsHeaders) headers.set(name, value);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	};

	// Apply CORS header for API routes requested with the OPTIONS method
	if (isApiRoute && event.request.method === 'OPTIONS')
		return new Response(null, { status: 204, headers: corsHeaders });

	const { url, route, locals } = event;
	const origin = url.host;

	if (!origin?.length) error(404, m.error_domain_unknown());

	const client = await findOneClientByOrigin(origin);
	locals.client = client;

	if (process.env.NODE_ENV !== 'production' && client.slug === DEFAULT_CLIENT_SLUG) await createDemoStories(client.id);

	const authusr = await findOneAuthenticatedUser(event);
	locals.authusr = authusr;

	const language = locals.authusr?.language ?? Language.English;
	locals.language = language;
	if (isLocale(language)) setLocale(language);

	const { id: routeFilePath } = route;
	const routeSegments = routeFilePath?.split('/').filter(Boolean) ?? [];

	const requiresAuthentication = routeSegments.includes('(authenticated)');
	const isAuthRoute = routeSegments.includes('(auth)');
	const isPublicRoute = routeSegments.includes('(public)');

	// Not $RoleX, trying to access (role:$RoleX|$RoleY|$RoleZ)/**
	const roles: (UserRole | 'client')[] =
		routeSegments
			.find((r) => r.startsWith('(role:') && r.endsWith(')'))
			?.slice('(role:'.length, -1)
			?.split('|')
			?.filter((r: string): r is UserRole | 'client' => ALLOWED_ROLES.has(r)) ?? [];
	const hasRequiredUserRole = authusr?.roles?.some((role) => roles.includes(role)) ?? false;

	// Trying to access API
	if (isApiRoute) {
		const apiError = (status: number, message: string) => withCors(json({ message }, { status }));

		let clientAuthorization: Awaited<ReturnType<typeof findOneAuthenticatedClient>> | undefined;
		if (requiresAuthentication && !authusr)
			clientAuthorization = await findOneAuthenticatedClient(event);
		const hasRequiredClientRole = roles.includes('client') && !!clientAuthorization;

		if (requiresAuthentication && !authusr && !clientAuthorization)
			apiError(403, m.error_authentication_missing_or_invalid());
		else if (roles?.length && !hasRequiredUserRole && !hasRequiredClientRole)
			apiError(403, m.error_missing_permissions());
		else return withCors(await resolve(event));
	}

	// Not authenticated, trying to access /auth/**
	if (!authusr && isAuthRoute) {
		if (
			routeFilePath === '/(app)/(auth)/auth' &&
			!locals.client?.authenticationMethods?.includes(ClientAuthenticationMethod.password)
		)
			redirect(302, '/');
		else if (
			routeFilePath?.startsWith('/(app)/(auth)/code') &&
			!locals.client?.authenticationMethods?.includes(ClientAuthenticationMethod.code)
		)
			redirect(302, '/');
		else return resolve(event);
	}

	// Authenticated, trying to access /auth/**
	if (authusr && isAuthRoute) {
		if (
			routeFilePath?.includes('/logout') ||
			routeFilePath?.startsWith('/(app)/(auth)/code') ||
			(locals.client?.authenticationMethods?.includes(ClientAuthenticationMethod.password) &&
				routeFilePath?.startsWith('/(app)/(auth)/auth/reset'))
		)
			return resolve(event);
		else redirect(302, '/');
	}

	// Not authenticated ...
	if (!authusr && !isPublicRoute) {
		// ... tyring to access anything except /auth/** with client.redirectUnauthorized set
		if (locals.client.redirectUnauthorized) redirect(302, locals.client.redirectUnauthorized);

		// ... trying to access (authenticated)/**
		if (requiresAuthentication) {
			if (locals.client?.authenticationMethods?.includes(ClientAuthenticationMethod.password))
				redirect(302, '/auth');
			else redirect(302, '/');
		}
	}

	// Authenticated trying to access '/' with client.redirectAuthorized set
	if (routeFilePath === '/' && locals.client.redirectAuthorized && authusr)
		redirect(302, locals.client.redirectAuthorized);

	if (roles?.length && !hasRequiredUserRole) redirect(302, '/');

	return resolve(event);
};

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => {
				const locale = getLocale();

				return html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale));
			}
		});
	});

export const handle = sequence(handleAuthorization, handleParaglide);
