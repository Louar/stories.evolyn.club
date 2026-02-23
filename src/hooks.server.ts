import { env } from '$env/dynamic/private';
import { createDemoStories } from '$lib/db/migrations/1-dummy-data/3-demo-stories';
import { findOneAuthenticatedUser, findOneClientByOrigin } from '$lib/db/repositories/1-client-user-module';
import { ClientAuthenticationMethod, UserRole } from '$lib/db/schemas/1-client-user-module';
import { error, redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const { url, route, locals } = event;

	const origin = url.origin?.replace(/^https?:\/\//, '') || null;
	if (!origin?.length) error(404, 'Domain unknown.');
	const client = await findOneClientByOrigin(origin);
	locals.client = client;

	if (process.env.NODE_ENV !== 'production' && client.reference === env.SECRET_DEFAULT_CLIENT_REFERENCE) await createDemoStories(client.id);

	const authusr = await findOneAuthenticatedUser(event);
	locals.authusr = authusr;

	const { id: routeFilePath } = route;

	// Trying to access API
	if (routeFilePath?.startsWith('/api')) {
		if (routeFilePath?.includes('(authenticated)') && !authusr) error(403, 'Authentication required');
		else if (routeFilePath?.includes('(role:admin)') && !authusr?.roles?.includes(UserRole.admin)) error(403, 'Admin role required');
		else return resolve(event);
	}

	// Not authenticated, trying to access /auth/**
	if (!authusr && routeFilePath?.includes('(auth)')) {
		if (routeFilePath === '/(app)/(auth)/auth' && !locals.client?.authenticationMethods?.includes(ClientAuthenticationMethod.password)) redirect(302, '/');
		else if (routeFilePath?.startsWith('/(app)/(auth)/code') && !locals.client?.authenticationMethods?.includes(ClientAuthenticationMethod.code)) redirect(302, '/');
		else return resolve(event);
	}

	// Authenticated, trying to access /auth/**
	if (authusr && routeFilePath?.includes('(auth)')) {
		if (routeFilePath?.includes('/logout') || routeFilePath?.startsWith('/(app)/(auth)/code')) return resolve(event);
		else redirect(302, '/');
	}

	// Not authenticated ...
	if (!authusr) {
		// ... tyring to access anything except /auth/** with client.redirectUnauthorized set
		if (locals.client.redirectUnauthorized) redirect(302, locals.client.redirectUnauthorized);

		// ... trying to access (authenticated)/**
		if (routeFilePath?.includes('(authenticated)')) {
			if (locals.client?.authenticationMethods?.includes(ClientAuthenticationMethod.password)) redirect(302, '/auth');
			else redirect(302, '/');
		}
	}

	// Authenticated (non-admin) trying to access '/' with client.redirectAuthorized set
	if (routeFilePath === '/' && locals.client.redirectAuthorized && authusr && !authusr?.roles?.includes(UserRole.admin)) redirect(302, locals.client.redirectAuthorized);

	// Not $RoleX, trying to access (role:$RoleX|$RoleY|$RoleZ)/**
	const roles: UserRole[] = routeFilePath
		?.split('/')
		?.find(r => r.startsWith('(role:') && r.endsWith(')'))
		?.replace('(role:', '')
		?.replace(')', '')
		?.split('|')
		?.filter((r: string): r is UserRole => Object.values(UserRole).includes(r as UserRole)) ?? [];
	if (roles?.length && !authusr?.roles?.some(r => roles.includes(r))) redirect(302, '/');

	return resolve(event);

}
