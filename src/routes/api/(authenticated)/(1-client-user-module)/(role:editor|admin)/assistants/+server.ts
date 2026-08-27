import { DEFAULT_OPENAI_API_KEY } from '$app/env/private';
import { createOpenAI } from '@ai-sdk/openai';
import {
	convertToModelMessages,
	createUIMessageStreamResponse,
	isLoopFinished,
	streamText,
	tool,
	toUIMessageStream,
	type UIMessage
} from 'ai';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod/v4';
import type { RequestHandler } from './$types';

const SPECIFICATION_FILE = path.resolve('static/generated/openapi-specification.yaml');

type OpenApiOperation = {
	operationId?: string;
	summary?: string;
	description?: string;
	tags?: string[];
	parameters?: unknown[];
	requestBody?: {
		content?: Record<string, { schema?: unknown }>;
	};
	responses?: Record<string, { description?: string }>;
};

type OpenApiSpecification = {
	paths?: Record<string, Partial<Record<string, OpenApiOperation>>>;
};

type AllowedApiOperation = {
	operationId: string;
	method: string;
	path: string;
	summary: string;
	description?: string;
	parameters: unknown[];
	requestBodySchema?: unknown;
	responses: Record<string, string>;
};

const openai = createOpenAI({
	apiKey: DEFAULT_OPENAI_API_KEY
});

let allowedOperationsPromise: Promise<AllowedApiOperation[]> | undefined;

const getAllowedOperations = async () => {
	allowedOperationsPromise ??= readFile(SPECIFICATION_FILE, 'utf8').then((yaml) => {
		const specification = parseYaml(yaml, { maxAliasCount: -1 }) as OpenApiSpecification;

		return Object.entries(specification.paths ?? {}).flatMap(([apiPath, methods]) => {
			return Object.entries(methods).flatMap(([method, operation]) => {
				if (!operation?.operationId || !operation.tags?.includes('AI')) return [];

				return [
					{
						operationId: operation.operationId,
						method: method.toUpperCase(),
						path: apiPath,
						summary: operation.summary ?? operation.operationId,
						description: operation.description,
						parameters: operation.parameters ?? [],
						requestBodySchema: operation.requestBody?.content?.['application/json']?.schema,
						responses: Object.fromEntries(
							Object.entries(operation.responses ?? {}).map(([status, response]) => [
								status,
								response.description ?? ''
							])
						)
					}
				];
			});
		});
	});

	return allowedOperationsPromise;
};

const scoreOperation = (operation: AllowedApiOperation, query: string) => {
	const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
	const haystack = [
		operation.operationId,
		operation.method,
		operation.path,
		operation.summary,
		operation.description,
		JSON.stringify(operation.parameters),
		JSON.stringify(operation.requestBodySchema)
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();

	return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
};

const parseResponseBody = async (response: Response) => {
	if (response.status === 204) return null;

	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		const text = await response.text();
		return text.length === 0 ? null : JSON.parse(text);
	}

	const text = await response.text();
	return text.length > 10_000 ? `${text.slice(0, 10_000)}...` : text;
};

const apiTools = (fetch: typeof globalThis.fetch) => ({
	listApiOperations: tool({
		description:
			'List all AI-approved API operations available to this assistant, including their operationIds and input schemas.',
		inputSchema: z.object({}),
		execute: async () => {
			return await getAllowedOperations();
		}
	}),
	searchApiOperations: tool({
		description:
			'Search AI-approved API operations that may satisfy the user prompt. Call this before executeApiOperation when you need API data or need to change API state, unless listApiOperations has already identified the exact operation.',
		inputSchema: z.object({
			query: z.string().describe('Search terms derived from the user prompt.'),
			limit: z
				.number()
				.int()
				.min(1)
				.max(10)
				.optional()
				.describe('Maximum number of operations to return.')
		}),
		execute: async ({ query, limit = 5 }) => {
			const operations = await getAllowedOperations();

			return operations
				.map((operation) => ({ operation, score: scoreOperation(operation, query) }))
				.filter(({ score }) => score > 0)
				.sort((a, b) => b.score - a.score)
				.slice(0, limit)
				.map(({ operation }) => operation);
		}
	}),
	executeApiOperation: tool({
		description:
			'Execute one AI-approved API operation by operationId. Use only operationIds returned by searchApiOperations, and provide path/query/body parameters that match the OpenAPI operation.',
		inputSchema: z.object({
			operationId: z.string().describe('The OpenAPI operationId to execute.'),
			pathParameters: z.record(z.string(), z.string()).optional(),
			queryParameters: z
				.record(
					z.string(),
					z.union([
						z.string(),
						z.number(),
						z.boolean(),
						z.array(z.union([z.string(), z.number(), z.boolean()]))
					])
				)
				.optional(),
			body: z
				.unknown()
				.optional()
				.describe('JSON request body for POST, PATCH, PUT, and DELETE operations.')
		}),
		execute: async (
			{ operationId, pathParameters = {}, queryParameters = {}, body },
			{ abortSignal }
		) => {
			const operations = await getAllowedOperations();
			const operation = operations.find((candidate) => candidate.operationId === operationId);

			if (!operation) {
				return {
					ok: false,
					error: `Operation ${operationId} is not AI-approved or does not exist.`
				};
			}

			const missingPathParameters = Array.from(operation.path.matchAll(/\{([^}]+)\}/g))
				.map((match) => match[1])
				.filter((parameter) => !pathParameters[parameter]);

			if (missingPathParameters.length > 0) {
				return {
					ok: false,
					error: `Missing path parameter(s): ${missingPathParameters.join(', ')}`
				};
			}

			const resolvedPath = operation.path.replace(/\{([^}]+)\}/g, (_, parameter: string) => {
				return encodeURIComponent(pathParameters[parameter]);
			});
			const url = new URL(`/api${resolvedPath}`, 'http://localhost');

			for (const [key, value] of Object.entries(queryParameters)) {
				if (Array.isArray(value)) {
					for (const item of value) url.searchParams.append(key, String(item));
				} else {
					url.searchParams.set(key, String(value));
				}
			}

			const canHaveBody = !['GET', 'HEAD'].includes(operation.method);

			const response = await fetch(`${url.pathname}${url.search}`, {
				method: operation.method,
				headers:
					body === undefined || !canHaveBody ? undefined : { 'content-type': 'application/json' },
				body: body === undefined || !canHaveBody ? undefined : JSON.stringify(body),
				signal: abortSignal
			});

			return {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				operation: {
					operationId: operation.operationId,
					method: operation.method,
					path: operation.path
				},
				body: await parseResponseBody(response)
			};
		}
	})
});

/**
 * @openapi
 * ignore: true
 */
export const POST = (async ({ request, fetch }) => {
	const { messages }: { messages: UIMessage[] } = await request.json();

	const result = streamText({
		model: openai('gpt-5.5'),
		instructions:
			'You are an assistant for editors and admins. When a user asks what API actions are available, list the AI-approved OpenAPI operations. When a user asks about data or asks to create, update, or delete data, first search or list the AI-approved OpenAPI operations, then execute only the matching approved API operation. After relevant API calls, return a short explanation or results overview before any details. Prefer a compact Markdown table for lists, comparisons, or tabular data, and keep summaries concise. Explain any API result clearly and do not invent data that was not returned by an API call.',
		messages: await convertToModelMessages(messages),
		tools: apiTools(fetch),
		stopWhen: isLoopFinished()
	});

	return createUIMessageStreamResponse({
		stream: toUIMessageStream({ stream: result.stream })
	});
}) satisfies RequestHandler;
