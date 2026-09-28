import { expect, type APIRequestContext } from '@playwright/test';
import type { DataTable } from 'playwright-bdd';
import { Given, When, Then } from './fixtures.test';
import type { ScenarioActor, ScenarioWorld } from '../support/world';

async function snapshot(world: ScenarioWorld, name: string) {
	const actor = await world.actor(name);
	world.entities.set(`account:actor:${name}`, actor);
	world.entities.set(`account:before:${name}`, await persistedUser(world, name));
	return actor;
}

function existingActor(world: ScenarioWorld, name: string): ScenarioActor {
	const actor = world.entities.get(`account:actor:${name}`) ?? world.findActor(name);
	expect(actor, `Missing actor setup for ${name}`).toBeTruthy();
	return actor;
}

async function persistedUser(world: ScenarioWorld, name: string) {
	const result = await world.db.query('SELECT * FROM "user" WHERE id = $1', [
		existingActor(world, name).id
	]);
	expect(result.rows).toHaveLength(1);
	return result.rows[0];
}

Given('the named users are available', async ({ world }) => {
	// Lazy identities keep account-creation targets absent until the tested request.
	expect(world.namespace).toBeTruthy();
});

Given(/^(.+) is authenticated through the API$/, async ({ world }, name: string) => {
	await snapshot(world, name);
});

Given(
	/^(.+) is (active|inactive) with exactly the global role "([^"]+)"$/,
	async ({ world }, name: string, state: string, role: string) => {
		const actor = await world.actor(name, [role]);
		if (state === 'inactive') {
			const response = await world.request('Admin Alpha', 'PATCH', `/api/users/${actor.id}`, {
				isActive: false
			});
			expect(response.status(), await response.text()).toBe(200);
		}
		await snapshot(world, name);
		expect(await persistedUser(world, name)).toMatchObject({
			is_active: state === 'active',
			roles: [role]
		});
	}
);

Given(/^(.+) has no authenticated session$/, async ({ world }, name: string) => {
	existingActor(world, name);
	const context = await world.newContext();
	expect((await context.storageState()).cookies).toEqual([]);
	world.entities.set(`account:anonymous:${name}`, context);
});

When(
	/^(.+) signs in through the API with (their correct|an incorrect|their former) password$/,
	async ({ world }, name: string, mode: string) => {
		const actor = existingActor(world, name);
		const context: APIRequestContext =
			world.entities.get(`account:anonymous:${name}`) ?? (await world.newContext());
		const response = await context.post('/api/auth', {
			data: {
				email: actor.email,
				password: mode === 'an incorrect' ? `${actor.password}-incorrect` : actor.password
			},
			maxRedirects: 0
		});
		world.responses.set('sign-in', response);
		world.entities.set('account:signInContext', context);
		world.entities.set('account:signInName', name);
	}
);

Then(
	/^the (user creation|user update|user deletion|user mutation|sign-in) response has status (\d+)$/,
	async ({ world }, key: string, status: string) => {
		const response = world.responses.get(key)!;
		expect(response).toBeTruthy();
		expect(response.status(), await response.text()).toBe(Number(status));
	}
);

Then(
	/^the user creation response has status 422 with an error for "([^"]+)"$/,
	async ({ world }, field: string) => {
		const response = world.responses.get('user creation')!;
		expect(response.status(), await response.text()).toBe(422);
		expect((await response.json()).errors[field]).toBeTruthy();
	}
);

Then(
	/^the sign-in response has status 201 and identifies (.+)$/,
	async ({ world }, name: string) => {
		const response = world.responses.get('sign-in')!;
		expect(response.status(), await response.text()).toBe(201);
		expect((await response.json()).id).toBe(existingActor(world, name).id);
	}
);

Then(
	'the sign-in response supplies a token and an HTTP-only session cookie for the current host',
	async ({ world }) => {
		const response = world.responses.get('sign-in')!;
		const { token } = await response.json();
		expect(token).toEqual(expect.any(String));
		expect(token.length).toBeGreaterThan(0);
		const context: APIRequestContext = world.entities.get('account:signInContext');
		const cookies = (await context.storageState()).cookies.filter(
			(cookie) => cookie.name === '__session' || cookie.name === '__session_stories'
		);
		expect(cookies).toHaveLength(1);
		expect(cookies[0]).toMatchObject({
			httpOnly: true,
			path: '/',
			domain: new URL(world.baseURL).hostname
		});
		expect(cookies[0].value).toBe(token);
	}
);

Then('the sign-in response supplies no token or usable session cookie', async ({ world }) => {
	expect((await world.responses.get('sign-in')!.json()).token).toBeUndefined();
	const context: APIRequestContext = world.entities.get('account:signInContext');
	expect(
		(await context.storageState()).cookies.filter(
			(cookie) =>
				(cookie.name === '__session' || cookie.name === '__session_stories') && cookie.value
		)
	).toEqual([]);
	const response = await context.get('/api/me', { maxRedirects: 0 });
	expect(response.status()).toBe(302);
	expect(new URL(response.headers().location, world.baseURL).href).toBe(
		new URL('/auth', world.baseURL).href
	);
	expect(response.ok()).toBe(false);
});

Then(
	/^(.+) can read their own profile with their exact user ID, current client ID, and global role "([^"]+)"$/,
	async ({ world }, name: string, role: string) => {
		expect(world.clientId).toBeTruthy();
		expect(world.entities.get('account:signInName')).toBe(name);
		const context: APIRequestContext = world.entities.get('account:signInContext');
		const profilePath = `/api/users/${existingActor(world, name).id}`;
		// /me forwards to a trailing-slash user URL, which SvelteKit canonicalizes.
		const forwarded = await context.get('/api/me', { maxRedirects: 0 });
		expect(forwarded.status(), await forwarded.text()).toBe(308);
		expect(new URL(forwarded.headers().location, world.baseURL).href).toBe(
			new URL(profilePath, world.baseURL).href
		);
		const response = await context.get(profilePath, { maxRedirects: 0 });
		expect(response.status(), await response.text()).toBe(200);
		expect(await response.json()).toMatchObject({
			id: existingActor(world, name).id,
			clientId: world.clientId,
			roles: [role]
		});
	}
);

Then(
	/^(.+)'s password, active status, and global roles are unchanged$/,
	async ({ world }, name: string) => {
		const before = world.entities.get(`account:before:${name}`);
		expect(await persistedUser(world, name)).toMatchObject({
			password: before.password,
			is_active: before.is_active,
			roles: before.roles
		});
	}
);

Then(
	/^(.+) remains inactive with exactly the global role "([^"]+)"$/,
	async ({ world }, name: string, role: string) => {
		expect(await persistedUser(world, name)).toMatchObject({ is_active: false, roles: [role] });
	}
);

Given(/^(.+) has not yet been created in the current client$/, async ({ world }, name: string) => {
	expect(world.findActor(name)).toBeUndefined();
	expect(world.clientId).toBeTruthy();
	const result = await world.db.query('SELECT id FROM "user" WHERE client_id = $1 AND email = $2', [
		world.clientId,
		world.identity(name).email
	]);
	expect(result.rows).toEqual([]);
});

When(
	/^(.+) creates (.+) with their scenario email, password, and exactly the global role "([^"]+)"$/,
	async ({ world }, creator: string, name: string, role: string) => {
		const identity = world.identity(name);
		const response = await world.request(creator, 'POST', '/api/users', {
			...identity,
			roles: [role],
			isActive: true,
			language: 'en'
		});
		world.responses.set('user creation', response);
		if (response.status() === 201) {
			const entity = await response.json();
			world.register('user', entity.id);
			// Do not authenticate yet: the subsequent sign-in step exercises the new password.
			world.entities.set(`account:actor:${name}`, { ...entity, ...identity });
		}
	}
);

Then(
	/^the created account belongs to the current client and has (.+)'s exact scenario email and global role "([^"]+)"$/,
	async ({ world }, name: string, role: string) => {
		expect(await persistedUser(world, name)).toMatchObject({
			client_id: world.clientId,
			email: world.identity(name).email,
			roles: [role],
			is_active: true
		});
	}
);

Given(/^(.+) has the following profile:$/, async ({ world }, name: string, table: DataTable) => {
	const response = await world.request(
		name,
		'PATCH',
		`/api/users/${existingActor(world, name).id}`,
		table.rowsHash()
	);
	expect(response.status(), await response.text()).toBe(200);
	await snapshot(world, name);
});

When(
	/^(.+) updates their own profile with:$/,
	async ({ world }, name: string, table: DataTable) => {
		world.responses.set(
			'user update',
			await world.request(
				name,
				'PATCH',
				`/api/users/${existingActor(world, name).id}`,
				table.rowsHash()
			)
		);
	}
);

Then(
	/^(.+) reads the following persisted profile:$/,
	async ({ world }, name: string, table: DataTable) => {
		const actor = existingActor(world, name);
		const response = await actor.request.get(`/api/users/${actor.id}`);
		expect(response.status(), await response.text()).toBe(200);
		expect(await response.json()).toMatchObject(table.rowsHash());
		const row = await persistedUser(world, name);
		for (const [key, value] of Object.entries(table.rowsHash())) {
			expect(row[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)]).toBe(value);
		}
	}
);

Then(
	/^(.+)'s user ID, client ID, email, and global roles are unchanged$/,
	async ({ world }, name: string) => {
		const before = world.entities.get(`account:before:${name}`);
		expect(await persistedUser(world, name)).toMatchObject({
			id: before.id,
			client_id: before.client_id,
			email: before.email,
			roles: before.roles
		});
	}
);

When(/^(.+) deletes their own account$/, async ({ world }, name: string) => {
	world.responses.set(
		'user deletion',
		await world.request(name, 'DELETE', `/api/users/${existingActor(world, name).id}`)
	);
});

Then(
	/^Admin Alpha receives status 404 when reading (.+)'s deleted account$/,
	async ({ world }, name: string) => {
		const id = existingActor(world, name).id;
		const response = await existingActor(world, 'Admin Alpha').request.get(`/api/users/${id}`);
		expect(response.status(), await response.text()).toBe(404);
		expect((await world.db.query('SELECT id FROM "user" WHERE id = $1', [id])).rows).toEqual([]);
	}
);

When(
	/^Editor Alpha attempts to create Participant Bravo with Participant Alpha's email and exactly the global role "([^"]+)"$/,
	async ({ world }, role: string) => {
		const response = await world.request('Editor Alpha', 'POST', '/api/users', {
			...world.identity('Participant Bravo'),
			email: existingActor(world, 'Participant Alpha').email,
			roles: [role]
		});
		world.responses.set('user creation', response);
		if (response.status() === 201) world.register('user', (await response.json()).id);
	}
);

Then(
	"exactly one account in the current client has Participant Alpha's email",
	async ({ world }) => {
		const result = await world.db.query(
			'SELECT * FROM "user" WHERE client_id = $1 AND email = $2',
			[world.clientId, existingActor(world, 'Participant Alpha').email]
		);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].id).toBe(existingActor(world, 'Participant Alpha').id);
	}
);

Then(
	'that account is still Participant Alpha with unchanged profile and global roles',
	async ({ world }) => {
		expect(await persistedUser(world, 'Participant Alpha')).toEqual(
			world.entities.get('account:before:Participant Alpha')
		);
	}
);

Then('no account has been created for Participant Bravo', async ({ world }) => {
	const result = await world.db.query('SELECT id FROM "user" WHERE client_id = $1 AND email = $2', [
		world.clientId,
		world.identity('Participant Bravo').email
	]);
	expect(result.rows).toEqual([]);
});

When(
	/^Participant Alpha attempts to (change the first name of|delete) Participant Bravo's account$/,
	async ({ world }, operation: string) => {
		world.responses.set(
			'user mutation',
			await world.request(
				'Participant Alpha',
				operation === 'delete' ? 'DELETE' : 'PATCH',
				`/api/users/${existingActor(world, 'Participant Bravo').id}`,
				operation === 'delete' ? undefined : { firstName: 'Forbidden replacement' }
			)
		);
	}
);

Then(
	"Participant Bravo's account still exists with unchanged profile, password, active status, and global roles",
	async ({ world }) => {
		expect(await persistedUser(world, 'Participant Bravo')).toEqual(
			world.entities.get('account:before:Participant Bravo')
		);
	}
);
