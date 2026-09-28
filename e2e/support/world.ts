import { createHash, randomUUID } from 'node:crypto';
import type { APIRequest, APIRequestContext, APIResponse, TestInfo } from '@playwright/test';
import { Pool } from 'pg';
import { assertTestEnvironment } from './environment';
import { assertTestSchema } from './database';

export interface ScenarioActor {
	id: string;
	email: string;
	password: string;
	roles: string[];
	request: APIRequestContext;
}

export interface ScenarioIdentity {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
}

// Descendants with cascade foreign keys are removed with their registered roots.
const cleanupOrder = [
	'anthology',
	'story',
	'quiz_logic_for_part',
	'taxonomy_draft_for_part',
	'quiz_template',
	'quiz_question_template_answer_group',
	'announcement_template',
	'animation',
	'video',
	'still',
	'taxonomy',
	'auth_code',
	'user_media',
	'user'
] as const;

export class ScenarioWorld {
	readonly namespace: string;
	/** SQL assertions use physical snake_case names; fixture setup uses the API. */
	readonly db: Pool;
	readonly ids = new Map<string, string>();
	// Domain helpers and account snapshots have different shapes.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readonly entities = new Map<string, any>();
	readonly responses = new Map<string, APIResponse>();
	clientId?: string;
	private readonly actors = new Map<string, Promise<ScenarioActor>>();
	private readonly identities = new Map<string, ScenarioIdentity>();
	private readonly resolvedActors = new Map<string, ScenarioActor>();
	private readonly contexts = new Set<APIRequestContext>();
	private readonly owned = new Map<string, Set<string>>();
	private baseline?: Promise<APIRequestContext>;
	private baselineId?: string;
	private disposed = false;

	constructor(
		private readonly requestFactory: APIRequest,
		readonly baseURL: string,
		testInfo: Pick<TestInfo, 'testId' | 'retry'>
	) {
		if (assertTestEnvironment(process.env) !== new URL(baseURL).origin) {
			throw new Error('The World baseURL must match the explicitly configured test application');
		}
		assertTestSchema(process.env);
		const hash = createHash('sha256').update(testInfo.testId).digest('hex').slice(0, 10);
		this.namespace = `bdd-${hash}-${testInfo.retry}-${randomUUID().replaceAll('-', '')}`;
		this.db = new Pool({
			database: process.env.POSTGRES_DB,
			host: process.env.POSTGRES_HOST,
			user: process.env.POSTGRES_USER,
			password: process.env.POSTGRES_PASSWORD,
			port: Number(process.env.POSTGRES_PORT),
			options: process.env.PGOPTIONS,
			max: 2,
			connectionTimeoutMillis: 10_000,
			statement_timeout: 15_000,
			application_name: this.namespace
		});
	}

	register(table: string, id: string): void {
		const physical = table.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
		if (!(cleanupOrder as readonly string[]).includes(physical)) {
			throw new Error(`Unsupported scenario-owned table: ${table}`);
		}
		if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
			throw new Error(`Expected UUID when registering ${table}`);
		}
		if (physical === 'user' && id === this.baselineId) {
			throw new Error('The baseline administrator cannot be scenario-owned');
		}
		const ids = this.owned.get(physical) ?? new Set<string>();
		ids.add(id);
		this.owned.set(physical, ids);
	}

	remember<T extends { id?: string }>(alias: string, entity: T, table?: string): T {
		if (table) {
			if (!entity.id) throw new Error(`Cannot register ${alias} without an id`);
			this.register(table, entity.id);
		}
		this.entities.set(alias, entity);
		if (entity.id) this.ids.set(alias, entity.id);
		return entity;
	}

	async newContext(): Promise<APIRequestContext> {
		if (this.disposed) throw new Error('The scenario World has been disposed');
		const context = await this.requestFactory.newContext({ baseURL: this.baseURL });
		this.contexts.add(context);
		return context;
	}

	identity(name: string): ScenarioIdentity {
		let identity = this.identities.get(name);
		if (!identity) {
			const hash = createHash('sha256').update(name).digest('hex').slice(0, 6);
			const [firstName, ...lastName] = name.split(' ');
			identity = {
				email: `${hash}-${this.namespace}@example.test`,
				password: `Scenario-${randomUUID()}`,
				firstName,
				lastName: lastName.join(' ') || firstName
			};
			this.identities.set(name, identity);
		}
		return identity;
	}

	findActor(name: string): ScenarioActor | undefined {
		return this.resolvedActors.get(name);
	}

	async actor(name: string, roles?: string[]): Promise<ScenarioActor> {
		let pending = this.actors.get(name);
		if (!pending) {
			const defaults = [
				/^Admin\b/i.test(name) ? 'admin' : /^Editor\b/i.test(name) ? 'editor' : 'participant'
			];
			pending = this.createActor(name, roles ?? defaults);
			this.actors.set(name, pending);
		}
		const actor = await pending;
		if (roles && [...roles].sort().join(',') !== [...actor.roles].sort().join(',')) {
			throw new Error(`Actor ${name} already exists with different roles`);
		}
		return actor;
	}

	async adoptActor(
		name: string,
		user: { id: string; roles: string[]; clientId?: string }
	): Promise<ScenarioActor> {
		const existing = this.resolvedActors.get(name);
		if (existing) {
			if (existing.id !== user.id) throw new Error(`Actor ${name} already refers to another user`);
			return existing;
		}
		this.register('user', user.id);
		this.clientId ??= user.clientId;
		const { email, password } = this.identity(name);
		const request = await this.newContext();
		const response = await request.post('/api/auth', {
			data: { email, password },
			maxRedirects: 0
		});
		if (response.status() !== 201)
			throw new Error(`Authenticating ${name} failed (${response.status()})`);
		const actor = this.remember(name, { id: user.id, email, password, roles: user.roles, request });
		this.resolvedActors.set(name, actor);
		this.actors.set(name, Promise.resolve(actor));
		return actor;
	}

	async api(actor: string | ScenarioActor): Promise<APIRequestContext> {
		return (typeof actor === 'string' ? await this.actor(actor) : actor).request;
	}

	async request(
		actor: string | ScenarioActor,
		method: string,
		path: string,
		data?: unknown
	): Promise<APIResponse> {
		const response = await (await this.api(actor)).fetch(path, { method, data, maxRedirects: 0 });
		this.responses.set(typeof actor === 'string' ? actor : actor.id, response);
		this.responses.set('last', response);
		return response;
	}

	private async baselineAdmin(): Promise<APIRequestContext> {
		this.baseline ??= (async () => {
			const email = process.env.DEFAULT_USER_EMAIL;
			const password = process.env.DEFAULT_USER_PASSWORD;
			if (!email || !password)
				throw new Error('Missing DEFAULT_USER_EMAIL / DEFAULT_USER_PASSWORD');
			const context = await this.newContext();
			const response = await context.post('/api/auth', {
				data: { email, password },
				maxRedirects: 0
			});
			if (response.status() !== 201)
				throw new Error(`Baseline authentication failed (${response.status()})`);
			const administrator = await response.json();
			this.baselineId = administrator.id;
			this.clientId = administrator.clientId;
			if (this.owned.get('user')?.has(this.baselineId!))
				throw new Error('Baseline administrator was registered for cleanup');
			return context;
		})();
		return this.baseline;
	}

	private async createActor(name: string, roles: string[]): Promise<ScenarioActor> {
		const response = await (
			await this.baselineAdmin()
		).post('/api/users', {
			data: { ...this.identity(name), roles, language: 'en', emailConfirmed: true },
			maxRedirects: 0
		});
		if (response.status() !== 201)
			throw new Error(`Provisioning ${name} failed (${response.status()})`);
		return this.adoptActor(name, await response.json());
	}

	private async collectDependencies(): Promise<void> {
		const users = [...(this.owned.get('user') ?? [])];
		for (const table of ['story', 'anthology'] as const) {
			const result = await this.db.query<{ id: string }>(
				`SELECT id FROM "${table}" WHERE created_by = ANY($1::uuid[])`,
				[users]
			);
			for (const row of result.rows) this.register(table, row.id);
		}
		const stories = [...(this.owned.get('story') ?? [])];
		// Parts point TO these roots: deleting a story alone would orphan them.
		for (const table of [
			'video',
			'animation',
			'still',
			'announcement_template',
			'quiz_logic_for_part',
			'taxonomy_draft_for_part'
		] as const) {
			const availability = ['video', 'animation', 'still', 'announcement_template'].includes(table);
			const result = await this.db.query<{ id: string }>(
				`
				SELECT DISTINCT ${table}_id AS id FROM part WHERE story_id = ANY($1::uuid[]) AND ${table}_id IS NOT NULL
				${availability ? `UNION SELECT ${table}_id AS id FROM ${table}_available_to_story WHERE story_id = ANY($1::uuid[]) AND ${table}_id IS NOT NULL` : ''}
			`,
				[stories]
			);
			for (const row of result.rows) {
				const shared = await this.db.query(
					`SELECT 1 FROM part WHERE ${table}_id = $1 AND NOT (story_id = ANY($2::uuid[]))
					${availability ? `UNION SELECT 1 FROM ${table}_available_to_story WHERE ${table}_id = $1 AND NOT (story_id = ANY($2::uuid[]))` : ''}`,
					[row.id, stories]
				);
				if (!shared.rowCount) this.register(table, row.id);
			}
		}
		const logic = [...(this.owned.get('quiz_logic_for_part') ?? [])];
		const quizzes = await this.db.query<{ id: string }>(
			`
			SELECT quiz_template_id AS id FROM quiz_logic_for_part WHERE id = ANY($1::uuid[])
			UNION SELECT quiz_template_id AS id FROM quiz_template_available_to_story WHERE story_id = ANY($2::uuid[]) AND quiz_template_id IS NOT NULL
		`,
			[logic, stories]
		);
		for (const row of quizzes.rows) {
			const shared = await this.db.query(
				`SELECT 1 FROM quiz_logic_for_part WHERE quiz_template_id = $1 AND NOT (id = ANY($2::uuid[]))
				UNION SELECT 1 FROM quiz_template_available_to_story WHERE quiz_template_id = $1 AND NOT (story_id = ANY($3::uuid[]))`,
				[row.id, logic, stories]
			);
			if (!shared.rowCount) this.register('quiz_template', row.id);
		}
		const quizIds = [...(this.owned.get('quiz_template') ?? [])];
		const groups = await this.db.query<{ id: string }>(
			`
			SELECT DISTINCT g.id FROM quiz_question_template_answer_group g
			JOIN quiz_question_template q ON q.quiz_question_template_answer_group_id = g.id
			WHERE q.quiz_template_id = ANY($1::uuid[]) AND NOT g.is_global
			AND NOT EXISTS (SELECT 1 FROM quiz_question_template other WHERE other.quiz_question_template_answer_group_id = g.id AND NOT (other.quiz_template_id = ANY($1::uuid[])))
		`,
			[quizIds]
		);
		for (const row of groups.rows) this.register('quiz_question_template_answer_group', row.id);
	}

	async dispose(): Promise<void> {
		if (this.disposed) return;
		await Promise.allSettled(this.actors.values());
		this.disposed = true;
		const errors: unknown[] = [];
		try {
			// A request can fail after inserting its user but before returning the ID.
			if (this.clientId && this.identities.size) {
				const users = await this.db.query<{ id: string }>(
					'SELECT id FROM "user" WHERE client_id = $1 AND email = ANY($2::text[])',
					[this.clientId, [...this.identities.values()].map((identity) => identity.email)]
				);
				for (const user of users.rows) this.register('user', user.id);
			}
			if (this.owned.size) await this.collectDependencies();
			for (const table of cleanupOrder) {
				const ids = [...(this.owned.get(table) ?? [])];
				if (!ids.length) continue;
				if (table === 'user' && this.baselineId && ids.includes(this.baselineId))
					throw new Error('Refusing to delete baseline administrator');
				await this.db.query(`DELETE FROM "${table}" WHERE id = ANY($1::uuid[])`, [ids]);
			}
		} catch (error) {
			errors.push(error);
		}
		const results = await Promise.allSettled([
			...Array.from(this.contexts, (context) => context.dispose()),
			this.db.end()
		]);
		for (const result of results) if (result.status === 'rejected') errors.push(result.reason);
		if (errors.length) throw new AggregateError(errors, 'Scenario cleanup failed');
	}
}
