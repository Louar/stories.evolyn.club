import { DEFAULT_CADDY_API_BASE_URL } from '$app/env/private';
import { dev } from '$app/environment';

type CaddyHostMatcher = {
	serverName: string;
	routeIndex: number;
	matchIndex: number;
	hosts: string[];
};

type CaddyRoute = {
	match?: Array<{ host?: unknown }>;
};

type CaddyServer = {
	routes?: CaddyRoute[];
};

type CaddyServers = Record<string, CaddyServer>;

type CaddyConfigResponse<T> = {
	value: T;
	etag: string | null;
};

type CaddyDomainRow = {
	id: string;
	domain: string;
};

const CADDY_SERVERS_PATH = '/config/apps/http/servers';
const MAX_ADD_RETRIES = 3;

const mockServers: CaddyServers = {
	mock: {
		routes: [
			{
				match: [
					{
						host: ['localhost:5173', 'localhost:4173', 'example.test']
					}
				]
			}
		]
	}
};

export class CaddyDomainError extends Error {
	constructor(
		message: string,
		readonly status = 500
	) {
		super(message);
		this.name = 'CaddyDomainError';
	}
}

const useMockCaddy = () => dev && !DEFAULT_CADDY_API_BASE_URL;

const getCaddyAdminBaseUrl = () => {
	const value = DEFAULT_CADDY_API_BASE_URL
	if (!value?.trim()) return null;
	return value.startsWith('http://') || value.startsWith('https://') ? value : `http://${value}`;
};

const normalizeCaddyPath = (path: string) => path.replace(/^\/+/, '');

const caddyUrl = (path: string) => {
	const baseUrl = getCaddyAdminBaseUrl() ?? 'http://localhost:2019';
	return new URL(normalizeCaddyPath(path), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
};

const readCaddyError = async (response: Response) => {
	const message = await response.text().catch(() => '');
	return message.trim() || response.statusText || 'Caddy Admin API request failed';
};

const caddyGetConfig = async <T>(path: string): Promise<CaddyConfigResponse<T>> => {
	if (useMockCaddy()) {
		if (path !== CADDY_SERVERS_PATH) throw new CaddyDomainError('Unsupported mock Caddy path');
		return { value: structuredClone(mockServers) as T, etag: 'mock' };
	}

	const response = await fetch(caddyUrl(path));
	if (!response.ok) throw new CaddyDomainError(await readCaddyError(response), response.status);
	return {
		value: (await response.json()) as T,
		etag: response.headers.get('etag')
	};
};

const caddyPatchConfig = async (path: string, value: unknown, etag?: string | null) => {
	if (useMockCaddy()) {
		const match = path.match(
			/^\/config\/apps\/http\/servers\/([^/]+)\/routes\/(\d+)\/match\/(\d+)\/host$/
		);
		if (!match) throw new CaddyDomainError('Unsupported mock Caddy path');
		const [, serverName, routeIndexValue, matchIndexValue] = match;
		const routeIndex = Number(routeIndexValue);
		const matchIndex = Number(matchIndexValue);
		const hosts = mockServers[serverName]?.routes?.[routeIndex]?.match?.[matchIndex]?.host;
		if (!Array.isArray(hosts))
			throw new CaddyDomainError('The mock Caddy route does not exist', 404);
		mockServers[serverName].routes![routeIndex].match![matchIndex].host = value;
		return;
	}

	const headers = new Headers({ 'Content-Type': 'application/json' });
	if (etag) headers.set('If-Match', etag);

	const response = await fetch(caddyUrl(path), {
		method: 'PATCH',
		headers,
		body: JSON.stringify(value)
	});
	if (!response.ok) throw new CaddyDomainError(await readCaddyError(response), response.status);
};

export const normalizeDomain = (value: unknown) => {
	if (typeof value !== 'string') throw new CaddyDomainError('Enter a domain', 400);
	const trimmed = value.trim().toLowerCase().replace(/\.$/, '');
	if (!trimmed) throw new CaddyDomainError('Enter a domain', 400);
	if (/^https?:\/\//i.test(trimmed) || /[/?#@]/.test(trimmed)) {
		throw new CaddyDomainError('Enter only the domain, without protocol or path', 400);
	}

	let url: URL;
	try {
		url = new URL(`http://${trimmed}`);
	} catch {
		throw new CaddyDomainError('Enter a valid domain', 400);
	}

	const host = url.hostname.replace(/\.$/, '').toLowerCase();
	const port = url.port;
	const labels = host.split('.');
	const validHost =
		host === 'localhost' ||
		(labels.length > 1 &&
			labels.every(
				(label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) && !/^\d+$/.test(label)
			));

	if (!validHost) throw new CaddyDomainError('Enter a valid domain', 400);
	return port ? `${host}:${port}` : host;
};

const normalizeConfiguredDomain = (value: unknown) => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim().toLowerCase().replace(/\.$/, '');
	return trimmed || null;
};

const getHostMatchers = (servers: CaddyServers): CaddyHostMatcher[] => {
	return Object.entries(servers).flatMap(([serverName, server]) =>
		(server.routes ?? []).flatMap((route, routeIndex) =>
			(route.match ?? []).flatMap((matcher, matchIndex) => {
				if (!Array.isArray(matcher.host)) return [];
				const hosts = matcher.host.filter((host): host is string => typeof host === 'string');
				return hosts.length ? [{ serverName, routeIndex, matchIndex, hosts }] : [];
			})
		)
	);
};

const getDomainsFromMatchers = (matchers: CaddyHostMatcher[]): CaddyDomainRow[] => {
	const domains = new Set<string>();
	for (const matcher of matchers) {
		for (const host of matcher.hosts) {
			const domain = normalizeConfiguredDomain(host);
			if (domain) domains.add(domain);
		}
	}

	return Array.from(domains)
		.sort((a, b) => a.localeCompare(b))
		.map((domain) => ({ id: domain, domain }));
};

const selectMatcherForDomain = (matchers: CaddyHostMatcher[]) => {
	if (!matchers.length) {
		throw new CaddyDomainError('No Caddy HTTP route with a host matcher was found', 400);
	}

	const defaultDomain = normalizeConfiguredDomain(process.env.DEFAULT_CLIENT_DEFAULT_DOMAIN);
	if (defaultDomain) {
		const defaultMatcher = matchers.find((matcher) =>
			matcher.hosts.some((host) => normalizeConfiguredDomain(host) === defaultDomain)
		);
		if (defaultMatcher) return defaultMatcher;
	}

	// This app owns the first configured host matcher when no default-client domain identifies a route.
	return matchers[0];
};

export const listCaddyDomains = async () => {
	const { value } = await caddyGetConfig<CaddyServers>(CADDY_SERVERS_PATH);
	return getDomainsFromMatchers(getHostMatchers(value));
};

export const addCaddyDomain = async (input: unknown) => {
	const domain = normalizeDomain(input);

	for (let attempt = 1; attempt <= MAX_ADD_RETRIES; attempt++) {
		const { value: servers, etag } = await caddyGetConfig<CaddyServers>(CADDY_SERVERS_PATH);
		const matchers = getHostMatchers(servers);
		const domains = getDomainsFromMatchers(matchers);
		if (domains.some((row) => row.domain === domain)) {
			throw new CaddyDomainError('This domain is already configured', 409);
		}

		const matcher = selectMatcherForDomain(matchers);
		const nextHosts = Array.from(new Set([...matcher.hosts, domain]));
		const path = `${CADDY_SERVERS_PATH}/${encodeURIComponent(matcher.serverName)}/routes/${matcher.routeIndex}/match/${matcher.matchIndex}/host`;

		try {
			await caddyPatchConfig(path, nextHosts, etag);
			return domain;
		} catch (error) {
			if (error instanceof CaddyDomainError && error.status === 412 && attempt < MAX_ADD_RETRIES) {
				continue;
			}
			throw error;
		}
	}

	throw new CaddyDomainError(
		'Caddy configuration changed while adding the domain. Try again.',
		409
	);
};
