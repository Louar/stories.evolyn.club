import ts from 'typescript';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { z } from 'zod/v4';

// Keep the Node runtime dependency explicit without requiring @types/node for this utility.
// Only the small API surface used below is described locally.
interface NodeDirent {
	name: string;
	isDirectory(): boolean;
	isFile(): boolean;
}

interface NodeFsPromises {
	access(filePath: string): Promise<void>;
	mkdir(directoryPath: string, options: { recursive: true }): Promise<unknown>;
	readdir(directoryPath: string, options: { withFileTypes: true }): Promise<NodeDirent[]>;
	readFile(filePath: string, encoding: 'utf8'): Promise<string>;
	writeFile(filePath: string, data: string, encoding: 'utf8'): Promise<void>;
}

interface NodePath {
	sep: string;
	resolve(...paths: string[]): string;
	dirname(filePath: string): string;
	relative(from: string, to: string): string;
	join(...paths: string[]): string;
}

interface NodeUrl {
	pathToFileURL(filePath: string): { href: string };
	fileURLToPath(url: string): string;
}

interface NodeProcess {
	argv: string[];
}

declare const process: NodeProcess;

async function importNodeBuiltin<T>(specifier: string): Promise<T> {
	return import(/* @vite-ignore */ specifier) as Promise<T>;
}

const [{ access, mkdir, readdir, readFile, writeFile }, path, { pathToFileURL, fileURLToPath }] =
	await Promise.all([
		importNodeBuiltin<NodeFsPromises>('node:fs/promises'),
		importNodeBuiltin<NodePath>('node:path'),
		importNodeBuiltin<NodeUrl>('node:url')
	]);

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
type HttpMethodLower = Lowercase<HttpMethod>;
type JsonSchema = SlugObject | SchemaObject;
type ResponseMap = Record<string, ResponseObject>;
type SecurityRequirementObject = Record<string, string[]>;

interface OpenApiExtensionMap {
	[key: `x-${string}`]: unknown;
}

interface SlugObject extends OpenApiExtensionMap {
	$ref: string;
}

interface ContactObject extends OpenApiExtensionMap {
	name?: string;
	url?: string;
	email?: string;
}

interface LicenseObject extends OpenApiExtensionMap {
	name: string;
	url?: string;
}

interface ExternalDocumentationObject extends OpenApiExtensionMap {
	description?: string;
	url: string;
}

interface ServerVariableObject extends OpenApiExtensionMap {
	enum?: string[];
	default: string;
	description?: string;
}

interface ServerObject extends OpenApiExtensionMap {
	url: string;
	name?: string;
	description?: string;
	variables?: Record<string, ServerVariableObject>;
}

interface InfoObject extends OpenApiExtensionMap {
	title: string;
	version: string;
	description?: string;
	termsOfService?: string;
	contact?: ContactObject;
	license?: LicenseObject;
}

interface TagObject extends OpenApiExtensionMap {
	name: string;
	description?: string;
	externalDocs?: ExternalDocumentationObject;
}

interface ExampleObject extends OpenApiExtensionMap {
	summary?: string;
	description?: string;
	value?: unknown;
	externalValue?: string;
}

interface XmlObject extends OpenApiExtensionMap {
	name?: string;
	namespace?: string;
	prefix?: string;
	attribute?: boolean;
	wrapped?: boolean;
}

interface DiscriminatorObject extends OpenApiExtensionMap {
	propertyName: string;
	mapping?: Record<string, string>;
}

interface HeaderObject extends OpenApiExtensionMap {
	description?: string;
	required?: boolean;
	deprecated?: boolean;
	allowEmptyValue?: boolean;
	style?: string;
	explode?: boolean;
	allowReserved?: boolean;
	schema?: JsonSchema;
	example?: unknown;
	examples?: Record<string, ExampleObject | SlugObject>;
	content?: Record<string, MediaTypeObject>;
}

interface ParameterObject extends OpenApiExtensionMap {
	name: string;
	in: 'query' | 'header' | 'path' | 'cookie';
	description?: string;
	required?: boolean;
	deprecated?: boolean;
	allowEmptyValue?: boolean;
	style?: string;
	explode?: boolean;
	allowReserved?: boolean;
	schema?: JsonSchema;
	example?: unknown;
	examples?: Record<string, ExampleObject | SlugObject>;
	content?: Record<string, MediaTypeObject>;
}

interface EncodingObject extends OpenApiExtensionMap {
	contentType?: string;
	headers?: Record<string, HeaderObject | SlugObject>;
	style?: string;
	explode?: boolean;
	allowReserved?: boolean;
}

interface MediaTypeObject extends OpenApiExtensionMap {
	schema?: JsonSchema;
	example?: unknown;
	examples?: Record<string, ExampleObject | SlugObject>;
	encoding?: Record<string, EncodingObject>;
}

interface RequestBodyObject extends OpenApiExtensionMap {
	description?: string;
	required?: boolean;
	content: Record<string, MediaTypeObject>;
}

interface LinkObject extends OpenApiExtensionMap {
	operationRef?: string;
	operationId?: string;
	parameters?: Record<string, unknown>;
	requestBody?: unknown;
	description?: string;
	server?: ServerObject;
}

interface ResponseObject extends OpenApiExtensionMap {
	description: string;
	headers?: Record<string, HeaderObject | SlugObject>;
	content?: Record<string, MediaTypeObject>;
	links?: Record<string, LinkObject | SlugObject>;
}

interface CallbackObject extends OpenApiExtensionMap {
	[expression: string]: PathItemObject | unknown;
}

interface OperationObject extends OpenApiExtensionMap {
	tags?: string[];
	summary?: string;
	description?: string;
	externalDocs?: ExternalDocumentationObject;
	operationId?: string;
	parameters?: ParameterObject[];
	requestBody?: RequestBodyObject;
	responses: ResponseMap;
	callbacks?: Record<string, CallbackObject | SlugObject>;
	deprecated?: boolean;
	security?: SecurityRequirementObject[];
	servers?: ServerObject[];
}

interface PathItemObject extends OpenApiExtensionMap {
	$ref?: string;
	summary?: string;
	description?: string;
	get?: OperationObject;
	put?: OperationObject;
	post?: OperationObject;
	delete?: OperationObject;
	options?: OperationObject;
	head?: OperationObject;
	patch?: OperationObject;
	trace?: OperationObject;
	servers?: ServerObject[];
	parameters?: Array<ParameterObject | SlugObject>;
}

interface SecuritySchemeObject extends OpenApiExtensionMap {
	type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
	description?: string;
	name?: string;
	in?: 'query' | 'header' | 'cookie';
	scheme?: string;
	bearerFormat?: string;
	flows?: OAuthFlowsObject;
	openIdConnectUrl?: string;
}

interface OAuthFlowObject extends OpenApiExtensionMap {
	authorizationUrl?: string;
	tokenUrl?: string;
	refreshUrl?: string;
	scopes: Record<string, string>;
}

interface OAuthFlowsObject extends OpenApiExtensionMap {
	implicit?: OAuthFlowObject;
	password?: OAuthFlowObject;
	clientCredentials?: OAuthFlowObject;
	authorizationCode?: OAuthFlowObject;
}

interface ComponentsObject extends OpenApiExtensionMap {
	schemas?: Record<string, JsonSchema>;
	responses?: Record<string, ResponseObject | SlugObject>;
	parameters?: Record<string, ParameterObject | SlugObject>;
	examples?: Record<string, ExampleObject | SlugObject>;
	requestBodies?: Record<string, RequestBodyObject | SlugObject>;
	headers?: Record<string, HeaderObject | SlugObject>;
	securitySchemes?: Record<string, SecuritySchemeObject | SlugObject>;
	links?: Record<string, LinkObject | SlugObject>;
	callbacks?: Record<string, CallbackObject | SlugObject>;
}

interface OpenApiDocument extends OpenApiExtensionMap {
	openapi: string;
	info: InfoObject;
	paths: Record<string, PathItemObject>;
	tags?: TagObject[];
	servers?: ServerObject[];
	security?: SecurityRequirementObject[];
	externalDocs?: ExternalDocumentationObject;
	components?: ComponentsObject;
	jsonSchemaDialect?: string;
	webhooks?: Record<string, PathItemObject | SlugObject>;
}

interface RouteAnalysisContext {
	program: ts.Program;
	typeChecker: ts.TypeChecker;
	sourceFile: ts.SourceFile;
	routeRuntime: Record<string, unknown> | null;
	schemaRuntime: Record<string, unknown> | null;
	requestSchemaBindings: Map<string, string>;
	routeSchemaDeclarations: Map<string, ts.Expression>;
	requestSchemaDeclarations: Map<string, ts.Expression>;
	schemaDeclarations: Map<string, ts.Expression>;
}

interface TypeScriptProjectCacheEntry {
	parsedConfig: ts.ParsedCommandLine;
	rootNames: Set<string>;
	program: ts.Program;
	typeChecker: ts.TypeChecker;
}

type TypeScriptProjectCache = Map<string, TypeScriptProjectCacheEntry>;

interface OpenApiOverrides {
	pathItem: Record<string, unknown> | null;
	operations: Partial<Record<HttpMethod, Record<string, unknown>>>;
	ignore: boolean;
}

interface PathOperationAnalysis {
	method: HttpMethod;
	node: ts.Node | null;
	operation: OperationObject;
}

interface SchemaObject extends OpenApiExtensionMap {
	title?: string;
	multipleOf?: number;
	maximum?: number;
	exclusiveMaximum?: number | boolean;
	minimum?: number;
	exclusiveMinimum?: number | boolean;
	maxLength?: number;
	minLength?: number;
	pattern?: string;
	maxItems?: number;
	minItems?: number;
	uniqueItems?: boolean;
	maxProperties?: number;
	minProperties?: number;
	required?: string[];
	enum?: Array<string | number | boolean | null>;
	type?:
		| 'string'
		| 'number'
		| 'integer'
		| 'boolean'
		| 'array'
		| 'object'
		| Array<'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'>;
	format?: string;
	description?: string;
	default?: unknown;
	nullable?: boolean;
	readOnly?: boolean;
	writeOnly?: boolean;
	example?: unknown;
	examples?: unknown[];
	deprecated?: boolean;
	xml?: XmlObject;
	externalDocs?: ExternalDocumentationObject;
	discriminator?: DiscriminatorObject;
	const?: unknown;
	properties?: Record<string, JsonSchema>;
	items?: JsonSchema;
	additionalProperties?: boolean | JsonSchema;
	oneOf?: JsonSchema[];
	anyOf?: JsonSchema[];
	allOf?: JsonSchema[];
	not?: JsonSchema;
}

const HTTP_METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const HTTP_METHOD_SET = new Set<HttpMethod>(HTTP_METHODS);
const OPENAPI_COOKIE_SECURITY_SCHEME_NAME = 'BearerAuthCookie';
const OPENAPI_HEADER_SECURITY_SCHEME_NAME = 'BearerAuthHeader';
const AUTHENTICATED_ROUTE_GROUP = '(authenticated)';
const ROLE_ROUTE_GROUP_PATTERN =
	/^\(role:((?:participant|editor|admin)(?:\|(?:participant|editor|admin))*)\)$/;
const ROUTES_ROOT = path.resolve('src/routes/api');
const UTILS_SCHEMA_FILE = path.resolve('src/lib/db/schemas/0-utils.ts');
const OUTPUT_FILE = path.resolve('static/generated/openapi-specification.yaml');
const TAG_ORDER = [
	'Authentication',
	'Current user (/me)',
	'Campaign',
	'Groups & holdings',
	'Input collections',
	'Menu items & app pages',
	'Missions & skills',
	'Providers & templates',
	'Users',
	'Media',
	'Clients',
	'Policies',
	'Assistant'
];
const TAG_ORDER_INDEX = new Map(TAG_ORDER.map((tag, index) => [tag, index] as const));

const DEFAULT_INFO = {
	info: {
		title: 'GameBus Core API',
		version: '4.0.0'
	},
	servers: [
		{
			name: 'Production',
			url: 'https://next.gamebus.eu/api'
		},
		{
			name: 'Development',
			url: 'http://localhost:5173/api'
		}
	],
	components: {
		securitySchemes: {
			[OPENAPI_COOKIE_SECURITY_SCHEME_NAME]: {
				type: 'apiKey',
				scheme: 'bearer',
				in: 'cookie',
				name: '__session',
				bearerFormat: 'JWT'
			},
			[OPENAPI_HEADER_SECURITY_SCHEME_NAME]: {
				description: 'Bearer token using a JWT',
				type: 'http',
				scheme: 'Bearer',
				bearerFormat: 'JWT'
			}
		}
	}
} satisfies Omit<OpenApiDocument, 'openapi' | 'paths'>;

const validationErrorSchema: JsonSchema = {
	type: 'object',
	properties: {
		errors: {
			type: 'object',
			additionalProperties: {
				type: 'array',
				items: { type: 'string' }
			}
		}
	}
};

const messageErrorSchema: JsonSchema = {
	type: 'object',
	properties: {
		message: { type: 'string' }
	}
};

const translatableSchemaCache = new WeakMap<ts.Program, JsonSchema>();

export async function extractOpenApiSpecification(
	outputFile = OUTPUT_FILE
): Promise<OpenApiDocument> {
	const spec = await generateOpenApiDocument();
	await mkdir(path.dirname(outputFile), { recursive: true });
	await writeFile(outputFile, stringifyYaml(spec), 'utf8');
	return spec;
}

export async function generateOpenApiDocument(): Promise<OpenApiDocument> {
	const filePaths = await collectRouteFiles(ROUTES_ROOT);
	const projectCache: TypeScriptProjectCache = new Map();

	const pathMap = new Map<string, PathItemObject>();
	const tags = new Set<string>();
	for (const filePath of filePaths.sort()) {
		const routeAnalysis = await analyzeRouteFile(filePath, projectCache);
		if (!routeAnalysis || routeAnalysis.operations.length === 0) continue;
		const operations = routeAnalysis.operations.map((operationAnalysis) => ({
			...operationAnalysis,
			operation: sortOperationTags(operationAnalysis.operation)
		}));
		for (const [openApiPath, pathItemForPath] of splitPathItemByOpenApiPath(
			filePath,
			operations,
			routeAnalysis.pathItemOverrides
		)) {
			pathMap.set(openApiPath, mergeOpenApi(pathMap.get(openApiPath) ?? {}, pathItemForPath));
		}
		for (const operation of operations)
			for (const tag of operation.operation.tags ?? []) tags.add(tag);
	}
	const paths = Object.fromEntries(Array.from(pathMap.entries()).sort(comparePathEntries));

	return {
		openapi: '3.2.0',
		...DEFAULT_INFO,
		...(tags.size > 0
			? {
					tags: Array.from(tags)
						.sort(compareTags)
						.map((name) => ({ name }))
				}
			: {}),
		paths
	};
}

function sortOperationTags(operation: OperationObject): OperationObject {
	return operation.tags ? { ...operation, tags: [...operation.tags].sort(compareTags) } : operation;
}

function comparePathEntries(
	[pathA, pathItemA]: [string, PathItemObject],
	[pathB, pathItemB]: [string, PathItemObject]
): number {
	return (
		compareTags(getPrimaryPathTag(pathItemA), getPrimaryPathTag(pathItemB)) ||
		pathA.localeCompare(pathB)
	);
}

function getPrimaryPathTag(pathItem: PathItemObject): string {
	for (const method of HTTP_METHODS) {
		const operation = pathItem[method.toLowerCase() as HttpMethodLower];
		const tag = operation?.tags?.[0];
		if (tag) return tag;
	}
	return '';
}

function compareTags(a: string, b: string): number {
	const indexA = TAG_ORDER_INDEX.get(a);
	const indexB = TAG_ORDER_INDEX.get(b);
	if (indexA !== undefined && indexB !== undefined) return indexA - indexB;
	if (indexA !== undefined) return -1;
	if (indexB !== undefined) return 1;
	return a.localeCompare(b);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
	await extractOpenApiSpecification();
}
async function analyzeRouteFile(
	filePath: string,
	projectCache: TypeScriptProjectCache
): Promise<{
	operations: PathOperationAnalysis[];
	pathItemOverrides: Record<string, unknown> | null;
} | null> {
	const sourceText = await readFile(filePath, 'utf8');
	const openApiOverrides = extractOpenApiOverrides(sourceText);
	if (openApiOverrides.ignore) return null;
	const analysis = await createRouteAnalysisContext(filePath, projectCache);
	const methodNodes = getExportedHttpMethodNodes(analysis.sourceFile);
	if (methodNodes.size === 0) return null;

	const operations: PathOperationAnalysis[] = [];

	for (const method of HTTP_METHODS) {
		const node = methodNodes.get(method);
		if (!node) continue;
		const operation = await buildOperation({ analysis, filePath, method, node });
		const merged = mergeOpenApi(operation, openApiOverrides.operations[method]);
		operations.push({ method, node, operation: merged });
	}

	return { operations, pathItemOverrides: openApiOverrides.pathItem };
}

async function buildOperation({
	analysis,
	filePath,
	method,
	node
}: {
	analysis: RouteAnalysisContext;
	filePath: string;
	method: HttpMethod;
	node: ts.Node | null;
}): Promise<OperationObject> {
	const parameters = inferParameters(filePath, node);
	const requestBody = await inferRequestBody(node, analysis, method);
	const responses = inferResponses(node, analysis, method);
	const security = inferSecurity(filePath);
	addSecurityResponses(responses, security);

	return {
		operationId: buildOperationId(filePath, method),
		summary: `${method} ${toOpenApiPath(filePath)}`,
		tags: inferTags(filePath),
		...(parameters.length > 0 ? { parameters } : {}),
		...(requestBody ? { requestBody } : {}),
		...(security.length > 0 ? { security } : {}),
		responses
	};
}

function inferSecurity(filePath: string): SecurityRequirementObject[] {
	const relative = path.relative(ROUTES_ROOT, path.dirname(filePath));
	const scopes = relative
		.split(path.sep)
		.flatMap((segment) => segment.match(ROLE_ROUTE_GROUP_PATTERN)?.[1].split('|') ?? [])
		.filter((role): role is 'participant' | 'editor' | 'admin' => Boolean(role));

	if (relative.split(path.sep).includes(AUTHENTICATED_ROUTE_GROUP) || scopes.length > 0) {
		const uniqueScopes = [...new Set(scopes)];
		return [
			{ [OPENAPI_COOKIE_SECURITY_SCHEME_NAME]: uniqueScopes },
			{ [OPENAPI_HEADER_SECURITY_SCHEME_NAME]: uniqueScopes }
		];
	}

	return [];
}

function addSecurityResponses(responses: ResponseMap, security: SecurityRequirementObject[]) {
	if (security.length === 0) return;
	responses['401'] ??= errorResponse('Unauthorized');
	const scopes = security.flatMap((requirement) => [
		...(requirement[OPENAPI_COOKIE_SECURITY_SCHEME_NAME] ?? []),
		...(requirement[OPENAPI_HEADER_SECURITY_SCHEME_NAME] ?? [])
	]);
	if (scopes.length > 0)
		responses['403'] ??= errorResponse(`${scopes.map(capitalize).join(' or ')} role required`);
}

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function inferTags(filePath: string): string[] {
	const relative = path
		.relative(ROUTES_ROOT, path.dirname(filePath))
		.split(path.sep)
		.filter(Boolean);
	const tags = relative.filter((part) => !part.startsWith('(') && !part.startsWith('['));
	return tags.length > 0 ? [tags[0]] : ['api'];
}

function inferParameters(filePath: string, node: ts.Node | null): ParameterObject[] {
	const filePathParameters = extractRouteParams(filePath);
	const queryParams = node ? collectQueryParams(node) : new Map<string, boolean>();

	const parameters: ParameterObject[] = filePathParameters.map((param) => ({
		name: param.name,
		in: 'path',
		// OpenAPI requires every path parameter to be required.
		required: true,
		schema: { type: 'string' }
	}));

	for (const [name, required] of Array.from(queryParams.entries())) {
		parameters.push({
			name,
			in: 'query',
			required,
			schema: { type: 'string' }
		});
	}

	return parameters;
}

async function inferRequestBody(
	node: ts.Node | null,
	analysis: RouteAnalysisContext,
	method: HttpMethod
): Promise<RequestBodyObject | undefined> {
	if (!node) return undefined;
	if (method === 'GET' || method === 'HEAD') return undefined;
	const sourceText = node.getText();

	const requestSchemas = [
		...collectParseBodySchemas(node, analysis),
		...collectRequestJsonValidationSchemas(node, analysis)
	];
	for (const { name: schemaName, expression } of requestSchemas) {
		const schema = chooseMostSpecificJsonSchema([
			schemaName ? getRequestSchemaFromAnalysis(analysis, schemaName) : null,
			inferZodSchemaFromExpression(expression, analysis),
			inferZodInputSchemaFromType(expression, analysis.typeChecker)
		]);
		if (schema) {
			return {
				required: true,
				content: {
					'application/json': {
						schema
					}
				}
			};
		}
	}

	if (containsContentTypeCheck(sourceText, 'application/json') || containsRequestJson(sourceText)) {
		const content: Record<string, MediaTypeObject> = {
			'application/json': { schema: { type: 'object', additionalProperties: true } }
		};

		if (containsRequestFormData(sourceText)) {
			content['multipart/form-data'] = {
				schema: {
					type: 'object',
					properties: {
						file: { type: 'string', format: 'binary' },
						description: { type: 'string' }
					},
					required: ['file']
				}
			};
		}

		return { required: true, content };
	}

	if (containsRequestFormData(sourceText)) {
		return {
			required: true,
			content: {
				'multipart/form-data': {
					schema: {
						type: 'object',
						additionalProperties: true
					}
				}
			}
		};
	}

	return undefined;
}

function inferResponses(
	node: ts.Node | null,
	analysis: RouteAnalysisContext,
	method: HttpMethod
): ResponseMap {
	const responses: ResponseMap = {};
	const returned = node ? collectResponses(node, analysis) : [];

	for (const response of returned) {
		responses[String(response.status)] = response.response;
	}

	if (Object.keys(responses).length === 0) {
		responses[defaultStatusForMethod(method)] = defaultResponseForStatus(
			defaultStatusForMethod(method)
		);
	}

	addDefaultErrors(responses, node);
	return responses;
}

function addDefaultErrors(responses: ResponseMap, node: ts.Node | null) {
	const text = node?.getText() ?? '';
	if (/error\(401,/.test(text)) responses['401'] ??= errorResponse('Unauthorized');
	if (/error\(403,/.test(text)) responses['403'] ??= errorResponse('Forbidden');
	if (/error\(404,/.test(text)) responses['404'] ??= errorResponse('Not found');
	if (/status:\s*422/.test(text)) responses['422'] ??= validationErrorResponse();
	if (/error\(400,/.test(text)) responses['400'] ??= errorResponse('Bad request');
}

function collectResponses(
	node: ts.Node,
	analysis: RouteAnalysisContext
): Array<{ status: number; response: ResponseObject }> {
	const responses: Array<{ status: number; response: ResponseObject }> = [];
	visit(node, (child) => {
		if (!ts.isReturnStatement(child) || !child.expression) return;

		const response = inferResponseFromExpression(child.expression, analysis);
		if (response) responses.push(response);
	});
	return dedupeResponses(responses);
}

function inferResponseFromExpression(
	expression: ts.Expression,
	analysis: RouteAnalysisContext
): { status: number; response: ResponseObject } | null {
	if (ts.isCallExpression(expression) && expression.expression.getText() === 'json') {
		const status = extractStatusFromJsonCall(expression) ?? 200;
		const schema = expression.arguments[0]
			? inferResponseSchemaFromExpression(expression.arguments[0], analysis)
			: undefined;
		return { status, response: jsonResponse(status, schema) };
	}

	if (ts.isNewExpression(expression) && expression.expression.getText() === 'Response') {
		const init = expression.arguments?.[1];
		const status = init ? (extractStatusFromObjectLiteral(init) ?? 200) : 200;
		const contentType = init ? extractContentTypeFromObjectLiteral(init) : undefined;
		const bodyExpression = expression.arguments?.[0];
		return {
			status,
			response: explicitResponse(status, bodyExpression, contentType, analysis)
		};
	}

	return null;
}

function explicitResponse(
	status: number,
	bodyExpression: ts.Expression | undefined,
	contentType: string | undefined,
	analysis: RouteAnalysisContext
): ResponseObject {
	if (status === 204) return { description: 'No Content' };
	const schema = bodyExpression
		? inferResponseSchemaFromExpression(bodyExpression, analysis)
		: undefined;
	const mediaType = contentType ?? 'application/json';
	return {
		description: descriptionForStatus(status),
		content: {
			[mediaType]: {
				schema:
					mediaType === 'application/json'
						? (schema ?? { type: 'object', additionalProperties: true })
						: (schema ?? fallbackSchemaForContentType(mediaType))
			}
		}
	};
}

function jsonResponse(status: number, schema?: JsonSchema): ResponseObject {
	if (status === 204) return { description: 'No Content' };
	return {
		description: descriptionForStatus(status),
		content: {
			'application/json': {
				schema: schema ?? { type: 'object', additionalProperties: true }
			}
		}
	};
}

function fallbackSchemaForContentType(contentType: string): JsonSchema {
	if (contentType === 'text/css' || contentType.startsWith('text/')) return { type: 'string' };
	return { type: 'string', format: 'binary' };
}

function defaultStatusForMethod(method: HttpMethod): `${number}` {
	if (method === 'POST') return '201';
	if (method === 'DELETE') return '204';
	return '200';
}

function defaultResponseForStatus(status: `${number}`): ResponseObject {
	if (status === '204') return { description: 'No Content' };
	return jsonResponse(Number(status));
}

function errorResponse(description: string): ResponseObject {
	return {
		description,
		content: {
			'application/json': {
				schema: messageErrorSchema
			}
		}
	};
}

function validationErrorResponse(): ResponseObject {
	return {
		description: 'Validation Error',
		content: {
			'application/json': {
				schema: validationErrorSchema
			}
		}
	};
}

function inferSchemaFromExpression(expression: ts.Expression): JsonSchema | undefined {
	if (
		ts.isAsExpression(expression) ||
		ts.isSatisfiesExpression(expression) ||
		ts.isParenthesizedExpression(expression)
	) {
		return inferSchemaFromExpression(expression.expression);
	}

	if (ts.isIdentifier(expression)) {
		if (expression.text === 'undefined') return undefined;
		return { type: 'object', additionalProperties: true };
	}

	if (ts.isAwaitExpression(expression)) return inferSchemaFromExpression(expression.expression);

	if (ts.isCallExpression(expression) && expression.expression.getText() === 'JSON.stringify') {
		return expression.arguments[0]
			? inferSchemaFromExpression(expression.arguments[0])
			: { type: 'string' };
	}

	if (ts.isObjectLiteralExpression(expression)) return inferSchemaFromObjectLiteral(expression);
	if (ts.isArrayLiteralExpression(expression)) return inferSchemaFromArrayLiteral(expression);
	if (ts.isStringLiteralLike(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
		return { type: 'string' };
	if (ts.isNumericLiteral(expression)) return { type: 'number' };
	if (
		expression.kind === ts.SyntaxKind.TrueKeyword ||
		expression.kind === ts.SyntaxKind.FalseKeyword
	)
		return { type: 'boolean' };
	if (expression.kind === ts.SyntaxKind.NullKeyword) return { nullable: true };

	return { type: 'object', additionalProperties: true };
}

function inferResponseSchemaFromExpression(
	expression: ts.Expression,
	analysis: RouteAnalysisContext,
	seen = new Set<ts.Node>()
): JsonSchema | undefined {
	if (seen.has(expression)) return inferSchemaFromType(expression, analysis.typeChecker);
	seen.add(expression);

	if (
		ts.isAsExpression(expression) ||
		ts.isSatisfiesExpression(expression) ||
		ts.isParenthesizedExpression(expression) ||
		ts.isAwaitExpression(expression)
	) {
		return inferResponseSchemaFromExpression(expression.expression, analysis, seen);
	}

	// A Response body containing JSON.stringify(...) contains the JSON value passed to
	// stringify, not a JSON string from an OpenAPI consumer's perspective.
	if (isJsonStringifyCall(expression)) {
		const value = expression.arguments[0];
		return value && ts.isExpression(value)
			? inferResponseSchemaFromExpression(value, analysis, seen)
			: undefined;
	}

	// Follow local aliases before asking the type checker for their (potentially
	// deliberately narrowed/contextual) declared type.
	if (ts.isIdentifier(expression)) {
		const initializer = getInitializerFromIdentifier(expression, analysis);
		if (initializer && initializer !== expression) {
			const initializerSchema = inferResponseSchemaFromExpression(initializer, analysis, seen);
			if (initializerSchema) return initializerSchema;
		}
	}

	// Preserve alternatives such as `value || {}` / `value ?? {}` rather than
	// collapsing them to whichever branch happens to score as more specific.
	if (
		ts.isBinaryExpression(expression) &&
		(expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
			expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
	) {
		const left = inferResponseSchemaFromExpression(expression.left, analysis, new Set(seen));
		const right = inferResponseSchemaFromExpression(expression.right, analysis, new Set(seen));
		return combineAlternativeSchemas(left, right);
	}

	// For indexed accumulator/map reads, infer from the actual values assigned to
	// the map. This avoids losing fields when the map has an intentionally narrow
	// annotation such as `{ activity: { id: string } }`.
	if (ts.isElementAccessExpression(expression)) {
		const assignedSchema = inferSchemaFromIndexedAssignments(expression, analysis, seen);
		if (assignedSchema) return assignedSchema;
	}

	if (ts.isObjectLiteralExpression(expression)) {
		const structural = inferResponseSchemaFromObjectLiteral(expression, analysis, seen);
		const byType = inferSchemaFromType(expression, analysis.typeChecker);
		return chooseMostSpecificJsonSchema([structural, byType]);
	}

	const runtimeSchema = inferRuntimeSchemaFromExpression(expression, analysis.routeRuntime);
	const typeSchema = inferSchemaFromType(expression, analysis.typeChecker);
	return chooseMostSpecificJsonSchema([runtimeSchema, typeSchema]);
}

function isJsonStringifyCall(expression: ts.Expression): expression is ts.CallExpression {
	return (
		ts.isCallExpression(expression) &&
		ts.isPropertyAccessExpression(expression.expression) &&
		ts.isIdentifier(expression.expression.expression) &&
		expression.expression.expression.text === 'JSON' &&
		expression.expression.name.text === 'stringify'
	);
}

function inferResponseSchemaFromObjectLiteral(
	objectLiteral: ts.ObjectLiteralExpression,
	analysis: RouteAnalysisContext,
	seen: Set<ts.Node>
): JsonSchema {
	const properties: Record<string, JsonSchema> = {};
	const required: string[] = [];

	for (const property of objectLiteral.properties) {
		if (ts.isSpreadAssignment(property)) {
			const spread = inferResponseSchemaFromExpression(property.expression, analysis, new Set(seen));
			const spreadObject = asSchemaObject(spread);
			if (spreadObject?.properties) Object.assign(properties, spreadObject.properties);
			for (const name of spreadObject?.required ?? []) required.push(name);
			continue;
		}

		if (ts.isShorthandPropertyAssignment(property)) {
			const name = property.name.text;
			const schema = inferResponseSchemaFromExpression(property.name, analysis, new Set(seen));
			if (schema) properties[name] = schema;
			required.push(name);
			continue;
		}

		if (!ts.isPropertyAssignment(property)) continue;
		const name = getPropertyName(property.name);
		if (!name) continue;
		const schema = inferResponseSchemaFromExpression(property.initializer, analysis, new Set(seen));
		if (schema) properties[name] = schema;
		required.push(name);
	}

	return {
		type: 'object',
		properties,
		...(Object.keys(properties).length === 0 ? { maxProperties: 0 } : {}),
		...(required.length > 0 ? { required: [...new Set(required)] } : {})
	};
}

function inferSchemaFromIndexedAssignments(
	expression: ts.ElementAccessExpression,
	analysis: RouteAnalysisContext,
	seen: Set<ts.Node>
): JsonSchema | undefined {
	if (!ts.isIdentifier(expression.expression)) return undefined;
	const initialTargetSymbol = analysis.typeChecker.getSymbolAtLocation(expression.expression);
	const targetSymbol =
		initialTargetSymbol && initialTargetSymbol.flags & ts.SymbolFlags.Alias
			? analysis.typeChecker.getAliasedSymbol(initialTargetSymbol)
			: initialTargetSymbol;
	if (!targetSymbol) return undefined;
	const schemas: JsonSchema[] = [];

	visit(analysis.sourceFile, (node) => {
		if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
		if (!ts.isElementAccessExpression(node.left) || !ts.isIdentifier(node.left.expression)) return;
		const initialCandidateSymbol = analysis.typeChecker.getSymbolAtLocation(node.left.expression);
		const candidateSymbol =
			initialCandidateSymbol && initialCandidateSymbol.flags & ts.SymbolFlags.Alias
				? analysis.typeChecker.getAliasedSymbol(initialCandidateSymbol)
				: initialCandidateSymbol;
		if (candidateSymbol !== targetSymbol) return;
		const schema = inferResponseSchemaFromExpression(node.right, analysis, new Set(seen));
		if (schema) schemas.push(schema);
	});

	if (schemas.length === 0) return undefined;
	return schemas.reduce<JsonSchema | undefined>(
		(combined, schema) => combineAlternativeSchemas(combined, schema),
		undefined
	);
}

function combineAlternativeSchemas(
	left: JsonSchema | undefined,
	right: JsonSchema | undefined
): JsonSchema | undefined {
	if (!left) return right;
	if (!right) return left;
	if (JSON.stringify(left) === JSON.stringify(right)) return left;
	const alternatives: JsonSchema[] = [];
	for (const schema of [left, right]) {
		const object = asSchemaObject(schema);
		if (object?.anyOf && Object.keys(object).length === 1) alternatives.push(...object.anyOf);
		else alternatives.push(schema);
	}
	return { anyOf: alternatives };
}

function inferRuntimeSchemaFromExpression(
	expression: ts.Expression,
	runtime: Record<string, unknown> | null
): JsonSchema | null {
	if (!runtime) return null;
	if (
		ts.isAsExpression(expression) ||
		ts.isSatisfiesExpression(expression) ||
		ts.isParenthesizedExpression(expression)
	) {
		return inferRuntimeSchemaFromExpression(expression.expression, runtime);
	}
	if (!ts.isIdentifier(expression)) return null;
	return getJsonSchemaFromRuntime(runtime[expression.text]);
}

function inferSchemaFromObjectLiteral(objectLiteral: ts.ObjectLiteralExpression): JsonSchema {
	const properties: Record<string, JsonSchema> = {};
	const required: string[] = [];

	for (const property of objectLiteral.properties) {
		if (!ts.isPropertyAssignment(property) || !getPropertyName(property.name)) continue;
		const name = getPropertyName(property.name)!;
		properties[name] = inferSchemaFromExpression(property.initializer) ?? {
			type: 'object',
			additionalProperties: true
		};
		required.push(name);
	}

	return {
		type: 'object',
		properties,
		...(required.length > 0 ? { required } : {})
	};
}

function inferSchemaFromArrayLiteral(arrayLiteral: ts.ArrayLiteralExpression): JsonSchema {
	const first = arrayLiteral.elements[0];
	return {
		type: 'array',
		items: first && ts.isExpression(first) ? (inferSchemaFromExpression(first) ?? {}) : {}
	};
}

function collectParseBodySchemas(
	node: ts.Node,
	analysis: RouteAnalysisContext
): Array<{ name: string | null; expression: ts.Expression }> {
	const schemas = new Map<string, { name: string | null; expression: ts.Expression }>();
	visit(node, (child) => {
		if (!ts.isCallExpression(child) || !isParseBodyCall(child, analysis.typeChecker)) return;
		const schemaArg = child.arguments[1];
		if (!schemaArg || !ts.isExpression(schemaArg)) return;
		const name = ts.isIdentifier(schemaArg)
			? (analysis.requestSchemaBindings.get(schemaArg.text) ?? schemaArg.text)
			: null;
		schemas.set(schemaArg.getText(), { name, expression: schemaArg });
	});
	return Array.from(schemas.values());
}

function collectRequestJsonValidationSchemas(
	node: ts.Node,
	analysis: RouteAnalysisContext
): Array<{ name: string | null; expression: ts.Expression }> {
	const schemas = new Map<string, { name: string | null; expression: ts.Expression }>();
	visit(node, (child) => {
		if (!ts.isCallExpression(child) || !ts.isPropertyAccessExpression(child.expression)) return;
		if (!['parse', 'safeParse', 'parseAsync', 'safeParseAsync'].includes(child.expression.name.text))
			return;
		const input = child.arguments[0];
		if (!input || !ts.isExpression(input) || !containsRequestJsonExpression(input)) return;
		const schemaExpression = child.expression.expression;
		const name = ts.isIdentifier(schemaExpression)
			? (analysis.requestSchemaBindings.get(schemaExpression.text) ?? schemaExpression.text)
			: null;
		schemas.set(schemaExpression.getText(), { name, expression: schemaExpression });
	});
	return Array.from(schemas.values());
}

function containsRequestJsonExpression(node: ts.Node): boolean {
	let found = false;
	visit(node, (child) => {
		if (found || !ts.isCallExpression(child) || !ts.isPropertyAccessExpression(child.expression))
			return;
		if (
			ts.isIdentifier(child.expression.expression) &&
			child.expression.expression.text === 'request' &&
			child.expression.name.text === 'json'
		) {
			found = true;
		}
	});
	return found;
}

function isParseBodyCall(call: ts.CallExpression, typeChecker: ts.TypeChecker): boolean {
	const callee = call.expression;
	if (ts.isIdentifier(callee) && callee.text === 'parseBody') return true;
	if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'parseBody') return true;

	const symbolLocation = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
	const initialSymbol = typeChecker.getSymbolAtLocation(symbolLocation);
	const symbol =
		initialSymbol && initialSymbol.flags & ts.SymbolFlags.Alias
			? typeChecker.getAliasedSymbol(initialSymbol)
			: initialSymbol;
	return symbol?.getName() === 'parseBody';
}

function collectQueryParams(node: ts.Node): Map<string, boolean> {
	const params = new Map<string, boolean>();
	const sourceText = node.getText();
	visit(node, (child) => {
		if (!ts.isCallExpression(child)) return;
		const exprText = child.expression.getText();
		if (exprText !== 'url.searchParams.get' && exprText !== 'request.url.searchParams.get') return;
		const arg = child.arguments[0];
		if (!arg || !ts.isStringLiteralLike(arg)) return;
		params.set(arg.text, inferQueryParamRequired(sourceText, arg.text));
	});
	return params;
}

function inferQueryParamRequired(sourceText: string, paramName: string): boolean {
	const escapedParamName = escapeRegExp(paramName);
	return (
		new RegExp(`${escapedParamName}[^\n;]*!`).test(sourceText) ||
		new RegExp(`!.*${escapedParamName}`).test(sourceText)
	);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsRequestJson(sourceText: string): boolean {
	return sourceText.includes('request.json(');
}

function containsRequestFormData(sourceText: string): boolean {
	return sourceText.includes('request.formData(');
}

function containsContentTypeCheck(sourceText: string, contentType: string): boolean {
	return sourceText.includes(contentType);
}

function extractStatusFromJsonCall(call: ts.CallExpression): number | undefined {
	const init = call.arguments[1];
	return init ? extractStatusFromObjectLiteral(init) : undefined;
}

function extractStatusFromObjectLiteral(expression: ts.Expression): number | undefined {
	if (!ts.isObjectLiteralExpression(expression)) return undefined;
	for (const property of expression.properties) {
		if (!ts.isPropertyAssignment(property) || getPropertyName(property.name) !== 'status') continue;
		if (ts.isNumericLiteral(property.initializer)) return Number(property.initializer.text);
		if (ts.isStringLiteralLike(property.initializer)) return Number(property.initializer.text);
	}
	return undefined;
}

function extractContentTypeFromObjectLiteral(expression: ts.Expression): string | undefined {
	if (!ts.isObjectLiteralExpression(expression)) return undefined;
	for (const property of expression.properties) {
		if (!ts.isPropertyAssignment(property) || getPropertyName(property.name) !== 'headers')
			continue;
		if (!ts.isObjectLiteralExpression(property.initializer)) return undefined;
		for (const headerProperty of property.initializer.properties) {
			if (!ts.isPropertyAssignment(headerProperty)) continue;
			const name = getPropertyName(headerProperty.name);
			if (name !== 'Content-Type' && name !== 'content-type') continue;
			if (ts.isStringLiteralLike(headerProperty.initializer))
				return headerProperty.initializer.text;
		}
	}
	return undefined;
}

function dedupeResponses(responses: Array<{ status: number; response: ResponseObject }>) {
	const map = new Map<number, ResponseObject>();
	for (const response of responses)
		map.set(
			response.status,
			mergeOpenApi(
				map.get(response.status) ?? { description: descriptionForStatus(response.status) },
				response.response
			)
		);
	return Array.from(map.entries()).map(([status, response]) => ({ status, response }));
}

function extractRouteParams(filePath: string): Array<{ name: string; required: boolean }> {
	const relative = path.relative(ROUTES_ROOT, filePath);
	const segments = relative.split(path.sep);
	const params: Array<{ name: string; required: boolean }> = [];

	for (const segment of segments) {
		const optionalMatch = segment.match(/^\[\[([^\]]+)\]\]$/);
		if (optionalMatch) {
			params.push({ name: optionalMatch[1], required: false });
			continue;
		}

		const requiredMatch = segment.match(/^\[([^\]]+)\]$/);
		if (requiredMatch)
			params.push({ name: requiredMatch[1].replace(/^\.\.\./, ''), required: true });
	}

	return params;
}

function toOpenApiPath(filePath: string): string {
	const relative = path.relative(ROUTES_ROOT, filePath).replace(/\\/g, '/');
	const route = relative
		.replace(/\/\+server\.ts$/, '')
		.split('/')
		.filter((segment) => !segment.startsWith('('))
		.map((segment) =>
			segment.replace(/^\[\[([^\]]+)\]\]$/, '{$1}').replace(/^\[([^\]]+)\]$/, '{$1}')
		)
		.join('/');
	return `/${route}`.replace(/\/\+/g, '/');
}

function splitPathItemByOpenApiPath(
	filePath: string,
	operations: PathOperationAnalysis[],
	pathItemOverrides: Record<string, unknown> | null
): Array<[string, PathItemObject]> {
	const defaultPath = toOpenApiPath(filePath);
	const trailingOptionalParameter = extractTrailingOptionalRouteParam(filePath);
	const trimmedPath = trailingOptionalParameter
		? toOpenApiPathWithoutTrailingOptionalParameter(filePath)
		: null;

	const pathItems = new Map<string, PathItemObject>();

	for (const { method, node, operation } of operations) {
		for (const openApiPath of getOpenApiPathsForOperation(
			method,
			node,
			trailingOptionalParameter,
			defaultPath,
			trimmedPath
		)) {
			const pathItem = pathItems.get(openApiPath) ?? {};
			pathItem[method.toLowerCase() as HttpMethodLower] = withPathParametersForOpenApiPath(
				operation,
				openApiPath,
				method,
				trailingOptionalParameter
			);
			pathItems.set(openApiPath, pathItem);
		}
	}

	if (pathItemOverrides) {
		const defaultPathItem = pathItems.get(defaultPath) ?? {};
		pathItems.set(defaultPath, mergeOpenApi(defaultPathItem, pathItemOverrides) as PathItemObject);
	}

	return Array.from(pathItems.entries());
}

function getOpenApiPathsForOperation(
	method: HttpMethod,
	node: ts.Node | null,
	trailingOptionalParameter: string | null,
	defaultPath: string,
	trimmedPath: string | null
): string[] {
	if (!trailingOptionalParameter || (method !== 'GET' && method !== 'POST')) return [defaultPath];
	if (!trimmedPath) return [defaultPath];

	// A SvelteKit [[param]] segment is syntactically optional, but an individual
	// handler can still make it semantically mandatory (for example by calling
	// requireParam(params.param, ...)). In that case the shorter route is not a
	// valid OpenAPI operation and must not be emitted.
	if (nodeRequiresParam(node, trailingOptionalParameter)) return [defaultPath];

	return nodeUsesParam(node, trailingOptionalParameter)
		? [trimmedPath, defaultPath]
		: [trimmedPath];
}

function toOpenApiPathWithoutTrailingOptionalParameter(filePath: string): string | null {
	const relative = path.relative(ROUTES_ROOT, filePath).replace(/\\/g, '/');
	if (!/\/\[\[[^\]]+\]\]\/\+server\.ts$/.test(relative)) return null;
	const trimmedFilePath = path.join(path.dirname(path.dirname(filePath)), '+server.ts');
	return toOpenApiPath(trimmedFilePath);
}

function extractTrailingOptionalRouteParam(filePath: string): string | null {
	const relative = path.relative(ROUTES_ROOT, filePath).replace(/\\/g, '/');
	return relative.match(/\/\[\[([^\]]+)\]\]\/\+server\.ts$/)?.[1] ?? null;
}

function nodeRequiresParam(node: ts.Node | null, paramName: string): boolean {
	if (!node) return false;

	const boundNames = collectParamBindingNames(node, paramName);
	let required = false;

	visit(node, (child) => {
		if (required || !ts.isCallExpression(child) || !isRequireParamCall(child)) return;
		const argument = child.arguments[0];
		if (argument && ts.isExpression(argument))
			required = expressionReferencesParam(argument, paramName, boundNames);
	});

	return required;
}

function isRequireParamCall(call: ts.CallExpression): boolean {
	const callee = call.expression;
	if (ts.isIdentifier(callee)) return callee.text === 'requireParam';
	return ts.isPropertyAccessExpression(callee) && callee.name.text === 'requireParam';
}

function collectParamBindingNames(node: ts.Node, paramName: string): Set<string> {
	const names = new Set<string>();

	visit(node, (child) => {
		if (!ts.isVariableDeclaration(child) || !ts.isObjectBindingPattern(child.name)) return;
		if (!child.initializer || !ts.isIdentifier(child.initializer) || child.initializer.text !== 'params')
			return;

		for (const element of child.name.elements) {
			const sourceName = element.propertyName
				? getPropertyName(element.propertyName)
				: getBindingElementName(element.name);
			const localName = getBindingElementName(element.name);
			if (sourceName === paramName && localName) names.add(localName);
		}
	});

	return names;
}

function expressionReferencesParam(
	expression: ts.Expression,
	paramName: string,
	boundNames: ReadonlySet<string>
): boolean {
	let found = false;

	visit(expression, (child) => {
		if (found) return;

		if (ts.isPropertyAccessExpression(child)) {
			if (
				ts.isIdentifier(child.expression) &&
				child.expression.text === 'params' &&
				child.name.text === paramName
			)
				found = true;
			return;
		}

		if (ts.isElementAccessExpression(child)) {
			if (!ts.isIdentifier(child.expression) || child.expression.text !== 'params') return;
			const argument = child.argumentExpression;
			if (argument && ts.isStringLiteralLike(argument) && argument.text === paramName) found = true;
			return;
		}

		if (ts.isIdentifier(child) && boundNames.has(child.text)) found = true;
	});

	return found;
}

function nodeUsesParam(node: ts.Node | null, paramName: string): boolean {
	if (!node) return false;
	let found = false;
	visit(node, (child) => {
		if (found) return;
		if (ts.isPropertyAccessExpression(child)) {
			if (child.name.text !== paramName) return;
			if (ts.isIdentifier(child.expression) && child.expression.text === 'params') found = true;
			return;
		}
		if (!ts.isVariableDeclaration(child) || !ts.isObjectBindingPattern(child.name)) return;
		if (
			!child.initializer ||
			!ts.isIdentifier(child.initializer) ||
			child.initializer.text !== 'params'
		)
			return;
		found = child.name.elements.some((element) => {
			const propertyName = element.propertyName ? getPropertyName(element.propertyName) : null;
			return (propertyName ?? getBindingElementName(element.name)) === paramName;
		});
	});
	return found;
}

function getBindingElementName(name: ts.BindingName): string | null {
	return ts.isIdentifier(name) ? name.text : null;
}

function withPathParametersForOpenApiPath(
	operation: OperationObject,
	openApiPath: string,
	method: HttpMethod,
	trailingOptionalParameter: string | null
): OperationObject {
	const pathParamNames = extractOpenApiPathParamNames(openApiPath);
	const nonPathParameters = (operation.parameters ?? []).filter(
		(parameter) => parameter.in !== 'path'
	);
	const pathParameters = pathParamNames.map((name) => ({
		name,
		in: 'path' as const,
		required: true,
		schema: { type: 'string' as const }
	}));
	const parameters = [...pathParameters, ...nonPathParameters];
	const operationWithoutParameters = omitGeneratedOperationOverrides(operation);
	const summary = summaryForOptionalRouteParameter(
		operation,
		pathParamNames,
		method,
		trailingOptionalParameter
	);
	return {
		...operationWithoutParameters,
		operationId: buildOperationIdFromOpenApiPath(openApiPath, method),
		...(summary ? { summary } : {}),
		...(parameters.length > 0 ? { parameters } : {})
	};
}

function omitGeneratedOperationOverrides(operation: OperationObject): OperationObject {
	const result = { ...(operation as OperationObject & Record<string, unknown>) };
	delete result.parameters;
	delete result['summary-one'];
	delete result['summary-all'];
	return result;
}

function summaryForOptionalRouteParameter(
	operation: OperationObject,
	pathParamNames: string[],
	method: HttpMethod,
	trailingOptionalParameter: string | null
): string | null {
	if (method !== 'GET') return null;
	if (!trailingOptionalParameter) return null;
	const override = operation as OperationObject & {
		'summary-one'?: unknown;
		'summary-all'?: unknown;
	};
	const value = pathParamNames.includes(trailingOptionalParameter)
		? override['summary-one']
		: override['summary-all'];
	return typeof value === 'string' ? value : null;
}

function extractOpenApiPathParamNames(openApiPath: string): string[] {
	return Array.from(openApiPath.matchAll(/\{([^}]+)\}/g), (match) => match[1]);
}

function buildOperationId(filePath: string, method: HttpMethod): string {
	return buildOperationIdFromOpenApiPath(toOpenApiPath(filePath), method);
}

function buildOperationIdFromOpenApiPath(openApiPath: string, method: HttpMethod): string {
	return `${method.toLowerCase()}_${openApiPath
		.replace(/[{}]/g, '')
		.replace(/[^a-zA-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')}`;
}

function descriptionForStatus(status: number): string {
	if (status === 200) return 'OK';
	if (status === 201) return 'Created';
	if (status === 204) return 'No Content';
	if (status === 400) return 'Bad Request';
	if (status === 401) return 'Unauthorized';
	if (status === 403) return 'Forbidden';
	if (status === 404) return 'Not Found';
	if (status === 422) return 'Unprocessable Entity';
	return `Status ${status}`;
}

function getExportedHttpMethodNodes(sourceFile: ts.SourceFile): Map<HttpMethod, ts.Node> {
	const methods = new Map<HttpMethod, ts.Node>();

	// Preserve the previous precedence: exported const handlers win over exported functions.
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (
				!ts.isIdentifier(declaration.name) ||
				!isHttpMethod(declaration.name.text) ||
				!declaration.initializer
			)
				continue;
			methods.set(declaration.name.text, unwrapHandlerNode(declaration.initializer));
		}
	}

	for (const statement of sourceFile.statements) {
		if (
			!ts.isFunctionDeclaration(statement) ||
			!statement.name ||
			!isHttpMethod(statement.name.text) ||
			!hasExportModifier(statement) ||
			methods.has(statement.name.text)
		)
			continue;
		methods.set(statement.name.text, statement);
	}

	return methods;
}

function hasExportModifier(node: ts.Node): boolean {
	return (
		ts.canHaveModifiers(node) &&
		Boolean(
			ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
		)
	);
}

function isHttpMethod(value: string): value is HttpMethod {
	return HTTP_METHOD_SET.has(value as HttpMethod);
}

function unwrapHandlerNode(node: ts.Expression): ts.Node {
	if (
		ts.isSatisfiesExpression(node) ||
		ts.isAsExpression(node) ||
		ts.isParenthesizedExpression(node)
	) {
		return unwrapHandlerNode(node.expression);
	}
	return node;
}

async function loadRouteRuntime(filePath: string): Promise<Record<string, unknown> | null> {
	try {
		const modulePath = `${pathToFileURL(path.resolve(filePath)).href}?t=${Date.now()}`;
		return (await import(modulePath)) as Record<string, unknown>;
	} catch {
		return null;
	}
}

async function createRouteAnalysisContext(
	filePath: string,
	projectCache: TypeScriptProjectCache
): Promise<RouteAnalysisContext> {
	const absoluteFilePath = path.resolve(filePath);
	const schemaFilePath = await findSiblingSchemaFile(absoluteFilePath);
	const requiredFiles = schemaFilePath
		? [absoluteFilePath, path.resolve(schemaFilePath)]
		: [absoluteFilePath];
	const { program, typeChecker } = getTypeScriptProjectContext(
		absoluteFilePath,
		requiredFiles,
		projectCache
	);
	const programSourceFile = findSourceFile(program, absoluteFilePath);
	if (!programSourceFile) {
		throw new Error(`The route was not included in the TypeScript program: ${absoluteFilePath}`);
	}
	const routeRuntime = await loadRouteRuntime(absoluteFilePath);
	const schemaRuntime = schemaFilePath ? await loadRouteRuntime(schemaFilePath) : null;

	return {
		program,
		typeChecker,
		sourceFile: programSourceFile,
		routeRuntime,
		schemaRuntime,
		requestSchemaBindings: collectRequestSchemaBindings(programSourceFile),
		routeSchemaDeclarations: collectVariableDeclarations(programSourceFile),
		requestSchemaDeclarations: collectExportedSchemaDeclarations(program, schemaFilePath),
		schemaDeclarations: collectSchemaDeclarations(program, schemaFilePath)
	};
}

function getTypeScriptProjectContext(
	filePath: string,
	requiredFiles: readonly string[],
	projectCache: TypeScriptProjectCache
): TypeScriptProjectCacheEntry {
	const configPath = ts.findConfigFile(path.dirname(filePath), ts.sys.fileExists, 'tsconfig.json');
	if (!configPath) throw new Error(`Could not find tsconfig.json for ${filePath}`);
	const cacheKey = canonicalFileName(configPath);
	const cached = projectCache.get(cacheKey);

	if (cached && requiredFiles.every((requiredFile) => findSourceFile(cached.program, requiredFile))) {
		return cached;
	}

	const parsedConfig = cached?.parsedConfig ?? loadTypeScriptProjectConfiguration(configPath);
	const rootNames = new Set(
		cached?.rootNames ?? parsedConfig.fileNames.map((name) => path.resolve(name))
	);
	for (const requiredFile of requiredFiles) rootNames.add(path.resolve(requiredFile));

	const program = ts.createProgram({
		rootNames: Array.from(rootNames),
		options: {
			...parsedConfig.options,
			noEmit: true
		},
		projectReferences: parsedConfig.projectReferences
	});
	const entry: TypeScriptProjectCacheEntry = {
		parsedConfig,
		rootNames,
		program,
		typeChecker: program.getTypeChecker()
	};
	projectCache.set(cacheKey, entry);
	return entry;
}

function loadTypeScriptProjectConfiguration(configPath: string): ts.ParsedCommandLine {
	const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
	if (configFile.error) throw new Error(formatTypeScriptDiagnostics([configFile.error]));

	const parsed = ts.parseJsonConfigFileContent(
		configFile.config,
		ts.sys,
		path.dirname(configPath),
		{ noEmit: true },
		configPath
	);
	if (parsed.errors.length > 0) throw new Error(formatTypeScriptDiagnostics(parsed.errors));
	return parsed;
}

function canonicalFileName(fileName: string): string {
	const resolved = ts.sys.resolvePath(fileName);
	return ts.sys.useCaseSensitiveFileNames ? resolved : resolved.toLowerCase();
}

function findSourceFile(program: ts.Program, filePath: string): ts.SourceFile | undefined {
	const target = canonicalFileName(filePath);
	return program
		.getSourceFiles()
		.find((sourceFile) => canonicalFileName(sourceFile.fileName) === target);
}

function formatTypeScriptDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
	return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
		getCanonicalFileName: (fileName) => fileName,
		getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
		getNewLine: () => ts.sys.newLine
	});
}

async function findSiblingSchemaFile(filePath: string): Promise<string | null> {
	const candidates = [
		path.join(path.dirname(filePath), 'schemas.ts'),
		path.join(path.dirname(filePath), '+schema.ts')
	];
	for (const candidate of candidates) {
		try {
			await access(candidate);
			return candidate;
		} catch {
			continue;
		}
	}
	return null;
}

function collectRequestSchemaBindings(sourceFile: ts.SourceFile): Map<string, string> {
	const bindings = new Map<string, string>();
	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement)) continue;
		const moduleSpecifier = ts.isStringLiteral(statement.moduleSpecifier)
			? statement.moduleSpecifier.text
			: '';
		if (!isSiblingSchemaImport(moduleSpecifier)) continue;
		const clause = statement.importClause;
		if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
		for (const element of clause.namedBindings.elements) {
			bindings.set(element.name.text, element.propertyName?.text ?? element.name.text);
		}
	}
	return bindings;
}

function isSiblingSchemaImport(moduleSpecifier: string): boolean {
	return (
		moduleSpecifier === './schemas' ||
		moduleSpecifier === './+schema' ||
		moduleSpecifier === './schemas.ts' ||
		moduleSpecifier === './+schema.ts' ||
		moduleSpecifier === './schemas.js' ||
		moduleSpecifier === './+schema.js'
	);
}

function collectExportedSchemaDeclarations(
	program: ts.Program,
	schemaFilePath: string | null
): Map<string, ts.Expression> {
	const declarations = new Map<string, ts.Expression>();
	if (!schemaFilePath) return declarations;

	const sourceFile = findSourceFile(program, schemaFilePath);
	if (!sourceFile) return declarations;

	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
			continue;
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
			declarations.set(declaration.name.text, declaration.initializer);
		}
	}

	return declarations;
}

function collectSchemaDeclarations(
	program: ts.Program,
	schemaFilePath: string | null
): Map<string, ts.Expression> {
	const declarations = new Map<string, ts.Expression>();
	if (!schemaFilePath) return declarations;

	const sourceFile = findSourceFile(program, schemaFilePath);
	if (!sourceFile) return declarations;
	return collectVariableDeclarations(sourceFile);
}

function collectVariableDeclarations(sourceFile: ts.SourceFile): Map<string, ts.Expression> {
	const declarations = new Map<string, ts.Expression>();

	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
			declarations.set(declaration.name.text, declaration.initializer);
		}
	}

	return declarations;
}

function getRequestSchemaFromAnalysis(
	analysis: RouteAnalysisContext,
	exportName: string
): JsonSchema | null {
	const declaration =
		analysis.requestSchemaDeclarations.get(exportName) ??
		analysis.routeSchemaDeclarations.get(exportName);
	const declarationSchema = declaration
		? inferZodSchemaFromExpression(declaration, analysis)
		: undefined;
	const inputTypeSchema = declaration
		? inferZodInputSchemaFromType(declaration, analysis.typeChecker)
		: undefined;
	const inferredSchema = chooseMostSpecificJsonSchema([declarationSchema, inputTypeSchema]);
	const runtimeSchema =
		getJsonSchemaFromRuntime(analysis.schemaRuntime?.[exportName], 'input') ??
		getJsonSchemaFromRuntime(analysis.routeRuntime?.[exportName], 'input');
	if (!runtimeSchema) return inferredSchema ?? null;
	return mergeTranslatableProperties(
		runtimeSchema,
		inferredSchema ?? null,
		declaration ? collectTranslatablePropertyNames(declaration, analysis) : new Set(),
		analysis.program
	);
}

function getInitializerFromIdentifier(
	identifier: ts.Identifier,
	analysis: RouteAnalysisContext
): ts.Expression | null {
	const initialSymbol = analysis.typeChecker.getSymbolAtLocation(identifier);
	const symbol =
		initialSymbol && initialSymbol.flags & ts.SymbolFlags.Alias
			? analysis.typeChecker.getAliasedSymbol(initialSymbol)
			: initialSymbol;
	const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
	if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer)
		return null;
	return declaration.initializer;
}

function mergeTranslatableProperties(
	runtimeSchema: JsonSchema,
	declarationSchema: JsonSchema | null,
	translatableProperties: Set<string>,
	program: ts.Program
): JsonSchema {
	if ('$ref' in runtimeSchema) return runtimeSchema;
	if (declarationSchema && '$ref' in declarationSchema) return runtimeSchema;
	if (
		declarationSchema &&
		!('$ref' in declarationSchema) &&
		isTranslatableSchema(declarationSchema)
	)
		return declarationSchema;

	if (runtimeSchema.oneOf || runtimeSchema.anyOf || runtimeSchema.allOf) {
		const declarationObject = asSchemaObject(declarationSchema ?? undefined);
		return {
			...runtimeSchema,
			...(runtimeSchema.oneOf
				? {
						oneOf: runtimeSchema.oneOf.map((schema) =>
							mergeTranslatableProperties(
								schema,
								declarationSchema,
								translatableProperties,
								program
							)
						)
					}
				: {}),
			...(runtimeSchema.anyOf
				? {
						anyOf: runtimeSchema.anyOf.map((schema) =>
							mergeTranslatableProperties(
								schema,
								declarationSchema,
								translatableProperties,
								program
							)
						)
					}
				: {}),
			...(runtimeSchema.allOf
				? {
						allOf: runtimeSchema.allOf.map((schema) =>
							mergeTranslatableProperties(
								schema,
								declarationSchema,
								translatableProperties,
								program
							)
						)
					}
				: {}),
			...(declarationObject?.properties || runtimeSchema.properties
				? {
						properties: mergeTranslatablePropertyMap(
							runtimeSchema.properties,
							declarationObject?.properties ?? {},
							translatableProperties,
							program
						)
					}
				: {})
		};
	}

	const runtimeObject = asSchemaObject(runtimeSchema);
	const declarationObject = asSchemaObject(declarationSchema ?? undefined);
	if (!runtimeObject?.properties) return runtimeSchema;

	return {
		...runtimeObject,
		properties: mergeTranslatablePropertyMap(
			runtimeObject.properties,
			declarationObject?.properties ?? {},
			translatableProperties,
			program
		)
	};
}

function mergeTranslatablePropertyMap(
	runtimeProperties: Record<string, JsonSchema> | undefined,
	declarationProperties: Record<string, JsonSchema>,
	translatableProperties: Set<string>,
	program: ts.Program
): Record<string, JsonSchema> {
	return Object.fromEntries(
		Object.entries(runtimeProperties ?? {}).map(([name, schema]) => [
			name,
			translatableProperties.has(name)
				? getTranslatableSchema(program)
				: isTranslatableSchema(declarationProperties[name])
					? declarationProperties[name]
					: mergeTranslatableProperties(
							schema,
							declarationProperties[name] ?? null,
							translatableProperties,
							program
						)
		])
	);
}

function collectTranslatablePropertyNames(
	expression: ts.Expression,
	analysis: RouteAnalysisContext,
	seen = new Set<ts.Expression>()
): Set<string> {
	const names = new Set<string>();
	if (seen.has(expression)) return names;
	seen.add(expression);

	if (ts.isIdentifier(expression)) {
		const declaration = analysis.schemaDeclarations.get(expression.text);
		if (declaration) return collectTranslatablePropertyNames(declaration, analysis, seen);
	}

	visit(expression, (node) => {
		if (ts.isIdentifier(node)) {
			const declaration = analysis.schemaDeclarations.get(node.text);
			if (declaration)
				for (const name of collectTranslatablePropertyNames(declaration, analysis, seen))
					names.add(name);
		}
		if (!ts.isPropertyAssignment(node) || !containsTranslatableValidator(node.initializer)) return;
		const name = getPropertyName(node.name);
		if (name) names.add(name);
	});
	return names;
}

function isTranslatableSchema(schema: JsonSchema | undefined): boolean {
	const object = asSchemaObject(schema);
	if (!object?.properties) return false;
	const keys = Object.keys(object.properties).sort();
	return (
		keys.includes('default') &&
		keys.includes('en') &&
		keys.includes('nl') &&
		keys.every((key) => {
			const property = object.properties?.[key];
			return property && !('$ref' in property) && property.type === 'string';
		})
	);
}

function inferZodSchemaFromExpression(
	expression: ts.Expression,
	analysis: RouteAnalysisContext
): JsonSchema | undefined {
	if (
		ts.isAsExpression(expression) ||
		ts.isSatisfiesExpression(expression) ||
		ts.isParenthesizedExpression(expression)
	) {
		return inferZodSchemaFromExpression(expression.expression, analysis);
	}

	if (ts.isIdentifier(expression)) {
		if (expression.text === 'translatableValidator') return getTranslatableSchema(analysis.program);
		const exportName = analysis.requestSchemaBindings.get(expression.text) ?? expression.text;
		const declaration =
			analysis.requestSchemaDeclarations.get(exportName) ??
			analysis.routeSchemaDeclarations.get(exportName);
		if (declaration && declaration !== expression) {
			const schema = inferZodSchemaFromExpression(declaration, analysis);
			if (schema) return schema;
		}
		const resolvedInitializer = getInitializerFromIdentifier(expression, analysis);
		if (resolvedInitializer && resolvedInitializer !== expression && resolvedInitializer !== declaration) {
			const schema = inferZodSchemaFromExpression(resolvedInitializer, analysis);
			if (schema) return schema;
		}
		return (
			getJsonSchemaFromRuntime(analysis.schemaRuntime?.[exportName], 'input') ??
			getJsonSchemaFromRuntime(analysis.routeRuntime?.[exportName], 'input') ??
			undefined
		);
	}

	if (!ts.isCallExpression(expression)) return undefined;

	const methodSchema = inferZodSchemaFromMethodCall(expression, analysis);
	if (methodSchema) return methodSchema;

	const callee = expression.expression.getText();
	if (callee === 'z.object' || callee === 'z.strictObject' || callee === 'z.looseObject')
		return inferZodObjectSchema(expression.arguments[0], analysis);
	if (callee === 'z.optional' || callee === 'z.readonly' || callee === 'z.nonoptional')
		return expression.arguments[0] && ts.isExpression(expression.arguments[0])
			? inferZodSchemaFromExpression(expression.arguments[0], analysis)
			: undefined;
	if (callee === 'z.nullable' || callee === 'z.nullish')
		return expression.arguments[0] && ts.isExpression(expression.arguments[0])
			? nullableSchema(inferZodSchemaFromExpression(expression.arguments[0], analysis))
			: nullableSchema(undefined);
	if (callee === 'z.default' || callee === 'z.catch')
		return expression.arguments[0] && ts.isExpression(expression.arguments[0])
			? inferZodSchemaFromExpression(expression.arguments[0], analysis)
			: undefined;
	if (callee === 'z.intersection') {
		const left = expression.arguments[0] && ts.isExpression(expression.arguments[0])
			? inferZodSchemaFromExpression(expression.arguments[0], analysis)
			: undefined;
		const right = expression.arguments[1] && ts.isExpression(expression.arguments[1])
			? inferZodSchemaFromExpression(expression.arguments[1], analysis)
			: undefined;
		if (!left) return right;
		if (!right) return left;
		return { allOf: [left, right] };
	}
	if (callee === 'z.array')
		return {
			type: 'array',
			items:
				expression.arguments[0] && ts.isExpression(expression.arguments[0])
					? (inferZodSchemaFromExpression(expression.arguments[0], analysis) ?? {})
					: {}
		};
	if (callee === 'z.union') return inferZodUnionSchema(expression.arguments[0], analysis);
	if (callee === 'z.discriminatedUnion')
		return inferZodDiscriminatedUnionSchema(expression, analysis);
	if (callee === 'z.literal') return inferZodLiteralSchema(expression.arguments[0]);
	if (callee === 'z.enum') return inferZodEnumSchema(expression.arguments[0], analysis);
	if (callee === 'z.record') return inferZodRecordSchema(expression, analysis);
	if (callee === 'z.string') return { type: 'string' };
	if (callee === 'z.uuid') return { type: 'string', format: 'uuid' };
	if (callee === 'z.number' || callee === 'z.coerce.number') return { type: 'number' };
	if (callee === 'z.int') return { type: 'integer' };
	if (callee === 'z.boolean' || callee === 'z.coerce.boolean') return { type: 'boolean' };
	if (callee === 'z.coerce.string') return { type: 'string' };
	if (callee === 'z.date' || callee === 'z.coerce.date')
		return { type: 'string', format: 'date-time' };
	if (callee === 'z.unknown' || callee === 'z.any') return {};
	if (callee === 'z.never') return undefined;
	if (callee === 'z.null') return { type: ['null'] };
	if (callee === 'z.preprocess')
		return expression.arguments[1] && ts.isExpression(expression.arguments[1])
			? inferZodSchemaFromExpression(expression.arguments[1], analysis)
			: undefined;

	return undefined;
}

function getTranslatableSchema(program: ts.Program): JsonSchema {
	const cached = translatableSchemaCache.get(program);
	if (cached) return cached;
	const languageKeys = getLanguageValues(program);
	const schema: JsonSchema = {
		type: 'object',
		properties: Object.fromEntries(
			[...languageKeys, 'default'].map((key) => [key, { type: 'string' } satisfies JsonSchema])
		)
	};
	translatableSchemaCache.set(program, schema);
	return schema;
}

function getLanguageValues(program: ts.Program): string[] {
	const sourceFile = findSourceFile(program, UTILS_SCHEMA_FILE);
	const languageValues: string[] = [];
	if (!sourceFile) return ['en', 'nl'];

	for (const statement of sourceFile.statements) {
		if (!ts.isEnumDeclaration(statement) || statement.name.text !== 'Language') continue;
		for (const member of statement.members) {
			const initializer = member.initializer;
			if (initializer && ts.isStringLiteralLike(initializer)) languageValues.push(initializer.text);
		}
	}

	return languageValues.length > 0 ? languageValues : ['en', 'nl'];
}

function inferZodSchemaFromMethodCall(
	call: ts.CallExpression,
	analysis: RouteAnalysisContext
): JsonSchema | undefined {
	if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
	const method = call.expression.name.text;
	if (isTranslatableValidatorExpression(call.expression.expression)) {
		const schema = getTranslatableSchema(analysis.program);
		if (method === 'nullable' || method === 'nullish') return nullableSchema(schema);
		return schema;
	}
	const base = inferZodSchemaFromExpression(call.expression.expression, analysis);
	if (base && containsTranslatableValidator(call.expression.expression)) {
		if (method === 'nullable' || method === 'nullish') return nullableSchema(base);
		return base;
	}

	if (method === 'extend' || method === 'safeExtend')
		return extendObjectSchema(base, call.arguments[0], analysis);
	if (method === 'merge')
		return mergeObjectSchema(base, call.arguments[0], analysis);
	if (method === 'pick') return pickObjectSchema(base, call.arguments[0]);
	if (method === 'omit') return omitObjectSchema(base, call.arguments[0]);
	if (method === 'partial') return partialObjectSchema(base, call.arguments[0]);
	if (method === 'required') return requiredObjectSchema(base, call.arguments[0]);
	if (method === 'and') return combineZodSchemas(base, call.arguments[0], analysis, 'allOf');
	if (method === 'or') return combineZodSchemas(base, call.arguments[0], analysis, 'oneOf');
	if (method === 'optional' || method === 'nonoptional') return base;
	if (method === 'nullable' || method === 'nullish') return nullableSchema(base);
	if (method === 'array') return { type: 'array', items: base ?? {} };
	if (method === 'min' || method === 'max' || method === 'length')
		return applyZodSizeConstraint(base, method, call.arguments[0]);
	if (method === 'email') return applySchemaFormat(base, 'email');
	if (method === 'url') return applySchemaFormat(base, 'uri');
	if (method === 'uuid') return applySchemaFormat(base, 'uuid');
	if (method === 'int') {
		const schema = asSchemaObject(base);
		return schema ? { ...schema, type: 'integer' } : base;
	}
	if (
		method === 'transform' ||
		method === 'refine' ||
		method === 'superRefine' ||
		method === 'pipe' ||
		method === 'default' ||
		method === 'catch' ||
		method === 'readonly' ||
		method === 'brand' ||
		method === 'describe' ||
		method === 'meta' ||
		method === 'overwrite' ||
		method === 'strict' ||
		method === 'strip' ||
		method === 'passthrough' ||
		method === 'loose' ||
		method === 'catchall' ||
		method === 'trim' ||
		method === 'regex' ||
		method === 'startsWith' ||
		method === 'endsWith' ||
		method === 'includes' ||
		method === 'lowercase' ||
		method === 'uppercase' ||
		method === 'normalize' ||
		method === 'positive' ||
		method === 'negative' ||
		method === 'nonnegative' ||
		method === 'nonpositive' ||
		method === 'multipleOf' ||
		method === 'finite' ||
		method === 'safe'
	)
		return base;

	return undefined;
}

function applyZodSizeConstraint(
	base: JsonSchema | undefined,
	method: 'min' | 'max' | 'length',
	argument: ts.Expression | undefined
): JsonSchema | undefined {
	const schema = asSchemaObject(base);
	if (!schema || !argument || !ts.isNumericLiteral(argument)) return base;
	const value = Number(argument.text);
	if (!Number.isFinite(value)) return base;

	const scalarType = Array.isArray(schema.type) ? undefined : schema.type;
	if (scalarType === 'array') {
		return {
			...schema,
			...(method === 'min' || method === 'length' ? { minItems: value } : {}),
			...(method === 'max' || method === 'length' ? { maxItems: value } : {})
		};
	}
	if (scalarType === 'string') {
		return {
			...schema,
			...(method === 'min' || method === 'length' ? { minLength: value } : {}),
			...(method === 'max' || method === 'length' ? { maxLength: value } : {})
		};
	}
	if (scalarType === 'number' || scalarType === 'integer') {
		if (method === 'min') return { ...schema, minimum: value };
		if (method === 'max') return { ...schema, maximum: value };
	}
	return base;
}

function applySchemaFormat(base: JsonSchema | undefined, format: string): JsonSchema | undefined {
	const schema = asSchemaObject(base);
	return schema ? { ...schema, format } : base;
}

function isTranslatableValidatorExpression(expression: ts.Expression): boolean {
	if (ts.isIdentifier(expression)) return expression.text === 'translatableValidator';
	if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression))
		return isTranslatableValidatorExpression(expression.expression.expression);
	if (
		ts.isParenthesizedExpression(expression) ||
		ts.isAsExpression(expression) ||
		ts.isSatisfiesExpression(expression)
	)
		return isTranslatableValidatorExpression(expression.expression);
	return false;
}

function containsTranslatableValidator(node: ts.Node): boolean {
	let found = false;
	visit(node, (child) => {
		if (ts.isIdentifier(child) && child.text === 'translatableValidator') found = true;
	});
	return found;
}

function inferZodObjectSchema(
	argument: ts.Expression | undefined,
	analysis: RouteAnalysisContext
): JsonSchema | undefined {
	if (!argument || !ts.isObjectLiteralExpression(argument))
		return { type: 'object', additionalProperties: true };
	return objectSchemaFromShape(argument, analysis);
}

function objectSchemaFromShape(
	shape: ts.ObjectLiteralExpression,
	analysis: RouteAnalysisContext
): JsonSchema {
	const properties: Record<string, JsonSchema> = {};
	const required: string[] = [];

	for (const property of shape.properties) {
		if (ts.isSpreadAssignment(property)) {
			const spreadSchema = inferZodSchemaFromExpression(property.expression, analysis);
			Object.assign(
				properties,
				spreadSchema && 'properties' in spreadSchema ? spreadSchema.properties : {}
			);
			for (const name of spreadSchema && 'required' in spreadSchema
				? (spreadSchema.required ?? [])
				: [])
				required.push(name);
			continue;
		}

		if (!ts.isPropertyAssignment(property)) continue;
		const name = getPropertyName(property.name);
		if (!name) continue;
		const schema = inferZodSchemaFromExpression(property.initializer, analysis);
		if (!schema) continue;
		properties[name] = schema;
		if (!isOptionalZodExpression(property.initializer)) required.push(name);
	}

	return {
		type: 'object',
		properties,
		...(required.length > 0 ? { required } : {})
	};
}

function extendObjectSchema(
	base: JsonSchema | undefined,
	extension: ts.Expression | undefined,
	analysis: RouteAnalysisContext
): JsonSchema | undefined {
	if (!extension || !ts.isObjectLiteralExpression(extension)) return base;
	const extensionSchema = objectSchemaFromShape(extension, analysis);
	const baseSchema = asSchemaObject(base);
	const extensionObjectSchema = asSchemaObject(extensionSchema);
	return {
		type: 'object',
		properties: {
			...(baseSchema?.properties ?? {}),
			...(extensionObjectSchema?.properties ?? {})
		},
		required: [...(baseSchema?.required ?? []), ...(extensionObjectSchema?.required ?? [])]
	};
}

function mergeObjectSchema(
	base: JsonSchema | undefined,
	argument: ts.Expression | undefined,
	analysis: RouteAnalysisContext
): JsonSchema | undefined {
	if (!argument) return base;
	const right = inferZodSchemaFromExpression(argument, analysis);
	const leftObject = asSchemaObject(base);
	const rightObject = asSchemaObject(right);
	if (!leftObject?.properties || !rightObject?.properties) {
		if (!base) return right;
		if (!right) return base;
		return { allOf: [base, right] };
	}
	return {
		type: 'object',
		properties: { ...leftObject.properties, ...rightObject.properties },
		...(leftObject.required?.length || rightObject.required?.length
			? { required: [...new Set([...(leftObject.required ?? []), ...(rightObject.required ?? [])])] }
			: {})
	};
}

function pickObjectSchema(
	base: JsonSchema | undefined,
	argument: ts.Expression | undefined
): JsonSchema | undefined {
	const object = asSchemaObject(base);
	if (!object?.properties || !argument || !ts.isObjectLiteralExpression(argument)) return base;
	const selected = collectTrueObjectKeys(argument);
	const properties = Object.fromEntries(
		Object.entries(object.properties).filter(([name]) => selected.has(name))
	);
	const required = (object.required ?? []).filter((name) => selected.has(name));
	return {
		...object,
		properties,
		...(required.length > 0 ? { required } : { required: undefined })
	};
}

function omitObjectSchema(
	base: JsonSchema | undefined,
	argument: ts.Expression | undefined
): JsonSchema | undefined {
	const object = asSchemaObject(base);
	if (!object?.properties || !argument || !ts.isObjectLiteralExpression(argument)) return base;
	const omitted = collectTrueObjectKeys(argument);
	const properties = Object.fromEntries(
		Object.entries(object.properties).filter(([name]) => !omitted.has(name))
	);
	const required = (object.required ?? []).filter((name) => !omitted.has(name));
	return {
		...object,
		properties,
		...(required.length > 0 ? { required } : { required: undefined })
	};
}

function requiredObjectSchema(
	base: JsonSchema | undefined,
	argument: ts.Expression | undefined
): JsonSchema | undefined {
	const object = asSchemaObject(base);
	if (!object?.properties) return base;
	const required =
		argument && ts.isObjectLiteralExpression(argument)
			? [...new Set([...(object.required ?? []), ...collectTrueObjectKeys(argument)])]
			: Object.keys(object.properties);
	return { ...object, required };
}

function collectTrueObjectKeys(argument: ts.ObjectLiteralExpression): Set<string> {
	const keys = new Set<string>();
	for (const property of argument.properties) {
		if (!ts.isPropertyAssignment(property) || property.initializer.kind !== ts.SyntaxKind.TrueKeyword)
			continue;
		const name = getPropertyName(property.name);
		if (name) keys.add(name);
	}
	return keys;
}

function combineZodSchemas(
	base: JsonSchema | undefined,
	argument: ts.Expression | undefined,
	analysis: RouteAnalysisContext,
	keyword: 'allOf' | 'oneOf'
): JsonSchema | undefined {
	const other = argument ? inferZodSchemaFromExpression(argument, analysis) : undefined;
	if (!base) return other;
	if (!other) return base;
	return keyword === 'allOf' ? { allOf: [base, other] } : { oneOf: [base, other] };
}

function partialObjectSchema(
	base: JsonSchema | undefined,
	argument: ts.Expression | undefined
): JsonSchema | undefined {
	if (!base || !('properties' in base)) return base;
	if (!argument || !ts.isObjectLiteralExpression(argument)) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { required: _required, ...schema } = base;
		return schema;
	}

	const partialFields = new Set<string>();
	for (const property of argument.properties) {
		if (!ts.isPropertyAssignment(property)) continue;
		const name = getPropertyName(property.name);
		if (!name || property.initializer.kind !== ts.SyntaxKind.TrueKeyword) continue;
		partialFields.add(name);
	}

	return {
		...base,
		required: (base.required ?? []).filter((name) => !partialFields.has(name))
	};
}

function nullableSchema(schema: JsonSchema | undefined): JsonSchema | undefined {
	if (!schema) return { type: ['null'] };
	return { oneOf: [{ type: ['null'] }, schema] };
}

function inferZodUnionSchema(
	argument: ts.Expression | undefined,
	analysis: RouteAnalysisContext
): JsonSchema | undefined {
	if (!argument || !ts.isArrayLiteralExpression(argument)) return undefined;
	const schemas = argument.elements
		.filter(ts.isExpression)
		.map((element) => inferZodSchemaFromExpression(element, analysis))
		.filter((schema): schema is JsonSchema => Boolean(schema));
	return schemas.length === 1 ? schemas[0] : { oneOf: schemas };
}

function inferZodDiscriminatedUnionSchema(
	call: ts.CallExpression,
	analysis: RouteAnalysisContext
): JsonSchema | undefined {
	const options = call.arguments[1];
	return inferZodUnionSchema(options, analysis);
}

function inferZodLiteralSchema(argument: ts.Expression | undefined): JsonSchema | undefined {
	if (!argument) return undefined;
	if (ts.isStringLiteralLike(argument)) return { type: 'string', enum: [argument.text] };
	if (ts.isNumericLiteral(argument)) return { type: 'number', enum: [Number(argument.text)] };
	if (argument.kind === ts.SyntaxKind.TrueKeyword) return { type: 'boolean', enum: [true] };
	if (argument.kind === ts.SyntaxKind.FalseKeyword) return { type: 'boolean', enum: [false] };
	if (argument.kind === ts.SyntaxKind.NullKeyword) return { type: ['null'] };
	return inferSchemaFromExpression(argument);
}

function inferZodEnumSchema(
	argument: ts.Expression | undefined,
	analysis: RouteAnalysisContext
): JsonSchema | undefined {
	if (!argument) return undefined;
	if (!ts.isArrayLiteralExpression(argument)) {
		const values = inferEnumValuesFromExpression(argument, analysis);
		return values.length > 0 ? jsonSchemaFromEnumValues(values) : undefined;
	}
	const values = argument.elements.flatMap((element): Array<string | number> => {
		if (ts.isStringLiteralLike(element)) return [element.text];
		if (ts.isNumericLiteral(element)) return [Number(element.text)];
		return [];
	});
	return values.length > 0 ? jsonSchemaFromEnumValues(values) : undefined;
}

function inferEnumValuesFromExpression(
	argument: ts.Expression,
	analysis: RouteAnalysisContext
): Array<string | number> {
	if (
		ts.isAsExpression(argument) ||
		ts.isSatisfiesExpression(argument) ||
		ts.isParenthesizedExpression(argument)
	) {
		return inferEnumValuesFromExpression(argument.expression, analysis);
	}

	if (ts.isIdentifier(argument) || ts.isPropertyAccessExpression(argument)) {
		const initialSymbol = analysis.typeChecker.getSymbolAtLocation(
			ts.isPropertyAccessExpression(argument) ? argument.name : argument
		);
		const symbol =
			initialSymbol && initialSymbol.flags & ts.SymbolFlags.Alias
				? analysis.typeChecker.getAliasedSymbol(initialSymbol)
				: initialSymbol;
		for (const declaration of symbol?.declarations ?? []) {
			if (ts.isEnumDeclaration(declaration)) {
				const values = declaration.members.flatMap((member): Array<string | number> => {
					const value = analysis.typeChecker.getConstantValue(member);
					return typeof value === 'string' || typeof value === 'number' ? [value] : [];
				});
				if (values.length > 0) return [...new Set(values)];
			}
			if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
				const values = inferEnumValuesFromExpression(declaration.initializer, analysis);
				if (values.length > 0) return values;
			}
		}

		if (ts.isIdentifier(argument)) {
			const localDeclaration = collectVariableDeclarations(argument.getSourceFile()).get(argument.text);
			if (localDeclaration) return inferEnumValuesFromExpression(localDeclaration, analysis);
		}
		return [];
	}

	if (
		ts.isCallExpression(argument) &&
		ts.isPropertyAccessExpression(argument.expression) &&
		ts.isIdentifier(argument.expression.expression) &&
		argument.expression.expression.text === 'Object' &&
		argument.expression.name.text === 'keys'
	) {
		const objectExpression = argument.arguments[0];
		if (objectExpression && ts.isExpression(objectExpression)) {
			const objectType = analysis.typeChecker.getApparentType(
				analysis.typeChecker.getTypeAtLocation(objectExpression)
			);
			const keys = objectType
				.getProperties()
				.map((property) => property.getName())
				.filter((name) => !name.startsWith('__@'));
			if (keys.length > 0) return [...new Set(keys)];
		}
	}

	if (!ts.isObjectLiteralExpression(argument)) return [];
	return argument.properties.flatMap((property): Array<string | number> => {
		if (!ts.isPropertyAssignment(property)) return [];
		if (ts.isStringLiteralLike(property.initializer)) return [property.initializer.text];
		if (ts.isNumericLiteral(property.initializer)) return [Number(property.initializer.text)];
		return [];
	});
}

function inferZodRecordSchema(
	call: ts.CallExpression,
	analysis: RouteAnalysisContext
): JsonSchema | undefined {
	const valueSchemaExpression = call.arguments[1] ?? call.arguments[0];
	const valueSchema =
		valueSchemaExpression && ts.isExpression(valueSchemaExpression)
			? inferZodSchemaFromExpression(valueSchemaExpression, analysis)
			: undefined;
	return {
		type: 'object',
		additionalProperties: valueSchema ?? true
	};
}

function isOptionalZodExpression(expression: ts.Expression): boolean {
	if (
		ts.isAsExpression(expression) ||
		ts.isSatisfiesExpression(expression) ||
		ts.isParenthesizedExpression(expression)
	)
		return isOptionalZodExpression(expression.expression);
	if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression))
		return false;
	const method = expression.expression.name.text;
	if (method === 'nonoptional') return false;
	return (
		method === 'optional' ||
		method === 'nullish' ||
		method === 'default' ||
		isOptionalZodExpression(expression.expression.expression)
	);
}

function asSchemaObject(schema: JsonSchema | undefined): SchemaObject | undefined {
	return schema && !('$ref' in schema) ? schema : undefined;
}

function chooseMostSpecificJsonSchema(
	candidates: Array<JsonSchema | null | undefined>
): JsonSchema | undefined {
	let best: JsonSchema | undefined;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (const candidate of candidates) {
		if (!candidate) continue;
		const score = jsonSchemaSpecificity(candidate);
		if (score > bestScore) {
			best = candidate;
			bestScore = score;
		}
	}
	return best;
}

function jsonSchemaSpecificity(schema: JsonSchema): number {
	if ('$ref' in schema) return 1000;
	let score = 1;
	if (schema.type) score += 3;
	if (schema.format) score += 4;
	if (schema.pattern) score += 4;
	if (schema.enum) score += 8 + schema.enum.length;
	if (schema.const !== undefined) score += 10;
	if (schema.required) score += schema.required.length;
	if (schema.additionalProperties === true) score -= 1;
	if (schema.properties) {
		score += Object.keys(schema.properties).length * 5;
		for (const propertySchema of Object.values(schema.properties)) {
			score += jsonSchemaSpecificity(propertySchema);
		}
	}
	if (schema.items) score += jsonSchemaSpecificity(schema.items);
	if (schema.oneOf) score += schema.oneOf.reduce((sum, item) => sum + jsonSchemaSpecificity(item), 0);
	if (schema.anyOf) score += schema.anyOf.reduce((sum, item) => sum + jsonSchemaSpecificity(item), 0);
	if (schema.allOf) score += schema.allOf.reduce((sum, item) => sum + jsonSchemaSpecificity(item), 0);
	for (const key of [
		'minLength',
		'maxLength',
		'minItems',
		'maxItems',
		'minimum',
		'maximum',
		'exclusiveMinimum',
		'exclusiveMaximum',
		'multipleOf'
	] as const) {
		if (schema[key] !== undefined) score += 2;
	}
	return score;
}

function inferZodInputSchemaFromType(
	expression: ts.Expression,
	typeChecker: ts.TypeChecker
): JsonSchema | undefined {
	const schemaType = typeChecker.getTypeAtLocation(expression);
	const directInput = getTypePropertyType(schemaType, '_input', expression, typeChecker);
	if (directInput) return jsonSchemaFromType(directInput, typeChecker, new Set(), expression);

	const zodInternals = getTypePropertyType(schemaType, '_zod', expression, typeChecker);
	if (!zodInternals) return undefined;
	const input = getTypePropertyType(zodInternals, 'input', expression, typeChecker);
	return input ? jsonSchemaFromType(input, typeChecker, new Set(), expression) : undefined;
}

function getTypePropertyType(
	type: ts.Type,
	propertyName: string,
	location: ts.Node,
	typeChecker: ts.TypeChecker
): ts.Type | undefined {
	const property = typeChecker.getPropertyOfType(type, propertyName);
	return property ? typeChecker.getTypeOfSymbolAtLocation(property, location) : undefined;
}

function inferSchemaFromType(
	expression: ts.Expression,
	typeChecker: ts.TypeChecker
): JsonSchema | undefined {
	const type = getJsonDataType(expression, typeChecker);
	return jsonSchemaFromType(type, typeChecker, new Set(), expression);
}

function getJsonDataType(expression: ts.Expression, typeChecker: ts.TypeChecker): ts.Type {
	if (
		ts.isAsExpression(expression) ||
		ts.isSatisfiesExpression(expression) ||
		ts.isParenthesizedExpression(expression)
	) {
		return getJsonDataType(expression.expression, typeChecker);
	}

	if (ts.isAwaitExpression(expression)) {
		return (
			typeChecker.getAwaitedType(typeChecker.getTypeAtLocation(expression.expression)) ??
			typeChecker.getTypeAtLocation(expression)
		);
	}

	const type = typeChecker.getTypeAtLocation(expression);
	return typeChecker.getAwaitedType(type) ?? type;
}

function jsonSchemaFromType(
	type: ts.Type,
	typeChecker: ts.TypeChecker,
	seen: Set<ts.Type>,
	location?: ts.Node
): JsonSchema | undefined {
	if (seen.has(type)) return { type: 'object', additionalProperties: true };
	seen.add(type);

	if (type.flags & ts.TypeFlags.Any || type.flags & ts.TypeFlags.Unknown)
		return { type: 'object', additionalProperties: true };
	const literalSchema = jsonSchemaFromLiteralType(type, typeChecker);
	if (literalSchema) return literalSchema;
	if (type.flags & ts.TypeFlags.String) return { type: 'string' };
	if (type.flags & ts.TypeFlags.Number) return { type: 'number' };
	if (type.flags & ts.TypeFlags.Boolean) return { type: 'boolean' };
	if (type.flags & ts.TypeFlags.Null) return { type: ['null'] };
	if (type.flags & ts.TypeFlags.Undefined || type.flags & ts.TypeFlags.Void) return undefined;
	if (isDateType(type)) return { type: 'string', format: 'date-time' };

	if (type.isUnion()) {
		const literalUnionSchema = jsonSchemaFromLiteralUnionType(type, typeChecker);
		if (literalUnionSchema) return literalUnionSchema;
		const schemas = type.types
			.map((member) => jsonSchemaFromType(member, typeChecker, new Set(seen), location))
			.filter((value): value is JsonSchema => Boolean(value));
		if (schemas.length === 0) return undefined;
		if (schemas.length === 1) return schemas[0];
		return compactOneOfSchemas(schemas);
	}

	if (type.isIntersection()) {
		const schemas = type.types
			.map((member) => jsonSchemaFromType(member, typeChecker, seen, location))
			.filter((value): value is JsonSchema => Boolean(value));
		if (schemas.length === 0) return undefined;
		if (schemas.length === 1) return schemas[0];
		return { allOf: schemas };
	}

	if (typeChecker.isArrayType(type) || typeChecker.isTupleType(type)) {
		const elementType = typeChecker.getTypeArguments(type as ts.TypeReference)[0];
		return {
			type: 'array',
			items: elementType ? (jsonSchemaFromType(elementType, typeChecker, seen, location) ?? {}) : {}
		};
	}

	const callSignatures = type.getCallSignatures();
	if (callSignatures.length > 0) return { type: 'object', additionalProperties: true };

	const stringIndexType = type.getStringIndexType();
	if (stringIndexType) {
		return {
			type: 'object',
			additionalProperties: jsonSchemaFromType(stringIndexType, typeChecker, seen, location) ?? true
		};
	}

	const properties = typeChecker.getApparentType(type).getProperties();
	if (properties.length === 0) return { type: 'object', additionalProperties: true };

	const objectProperties: Record<string, JsonSchema> = {};
	const required: string[] = [];

	for (const property of properties) {
		const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? location;
		if (!declaration) continue;
		const propertyType = typeChecker.getTypeOfSymbolAtLocation(property, declaration);
		const propertySchema = jsonSchemaFromType(
			propertyType,
			typeChecker,
			new Set(seen),
			declaration
		);
		if (!propertySchema) continue;
		objectProperties[property.name] = propertySchema;
		if (!(property.flags & ts.SymbolFlags.Optional)) required.push(property.name);
	}

	return {
		type: 'object',
		properties: objectProperties,
		...(required.length > 0 ? { required } : {})
	};
}

function jsonSchemaFromLiteralUnionType(
	type: ts.UnionType,
	typeChecker: ts.TypeChecker
): JsonSchema | undefined {
	const values: Array<string | number | boolean | null> = [];
	for (const member of type.types) {
		if (member.flags & ts.TypeFlags.Undefined || member.flags & ts.TypeFlags.Void) {
			continue;
		}

		const value = getLiteralValueFromType(member, typeChecker);
		if (value === undefined) return undefined;
		values.push(value);
	}

	if (values.length === 0) return undefined;
	return jsonSchemaFromEnumValues([...new Set(values)]);
}

function jsonSchemaFromLiteralType(
	type: ts.Type,
	typeChecker: ts.TypeChecker
): JsonSchema | undefined {
	const value = getLiteralValueFromType(type, typeChecker);
	return value === undefined ? undefined : jsonSchemaFromEnumValues([value]);
}

function getLiteralValueFromType(
	type: ts.Type,
	typeChecker: ts.TypeChecker
): string | number | boolean | null | undefined {
	if (type.flags & ts.TypeFlags.StringLiteral) return (type as ts.StringLiteralType).value;
	if (type.flags & ts.TypeFlags.NumberLiteral) return (type as ts.NumberLiteralType).value;
	if (type.flags & ts.TypeFlags.BooleanLiteral) {
		const text = typeChecker.typeToString(type);
		if (text === 'true') return true;
		if (text === 'false') return false;
	}
	if (type.flags & ts.TypeFlags.Null) return null;
	return undefined;
}

function jsonSchemaFromEnumValues(values: Array<string | number | boolean | null>): JsonSchema {
	if (values.length === 1 && values[0] === null) return { type: ['null'] };
	const nonNullValues = values.filter((value) => value !== null);
	const types = Array.from(
		new Set(values.map((value) => (value === null ? 'null' : typeof value)))
	) as Array<'string' | 'number' | 'boolean' | 'null'>;
	const primitiveTypes = types.filter((type) => type !== 'null') as Array<
		'string' | 'number' | 'boolean'
	>;
	const schema: SchemaObject = {
		...(primitiveTypes.length === 1 ? { type: primitiveTypes[0] } : {}),
		enum: values
	};
	if (values.includes(null) && nonNullValues.length > 0 && primitiveTypes.length === 1)
		return { oneOf: [{ type: ['null'] }, { type: primitiveTypes[0], enum: nonNullValues }] };
	return schema;
}

function compactOneOfSchemas(schemas: JsonSchema[]): JsonSchema {
	const enumValues: Array<string | number | boolean | null> = [];
	for (const schema of schemas) {
		const object = asSchemaObject(schema);
		if (!object) return { oneOf: schemas };
		if (object.enum?.length === 1) {
			enumValues.push(object.enum[0]);
			continue;
		}
		if (object.const !== undefined) {
			enumValues.push(object.const as string | number | boolean | null);
			continue;
		}
		return { oneOf: schemas };
	}
	return enumValues.length > 1 ? jsonSchemaFromEnumValues(enumValues) : { oneOf: schemas };
}

function isDateType(type: ts.Type): boolean {
	return type.symbol?.getName() === 'Date';
}

type ZodSchemaIo = 'input' | 'output';

function isRuntimeZodSchema(value: unknown): value is z.ZodType {
	return (
		value instanceof z.ZodType ||
		(value !== null && typeof value === 'object' && ('_zod' in value || 'def' in value))
	);
}

function getJsonSchemaFromRuntime(value: unknown, io: ZodSchemaIo = 'output'): JsonSchema | null {
	if (!isRuntimeZodSchema(value)) return null;
	try {
		return z.toJSONSchema(
			value,
			io === 'input'
				? { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' }
				: { target: 'openapi-3.0' }
		) as JsonSchema;
	} catch {
		return getJsonSchemaFromZodFallback(value, io);
	}
}

function getJsonSchemaFromZodFallback(schema: z.ZodType, io: ZodSchemaIo): JsonSchema {
	const def = (schema as { def?: { type?: string } }).def;
	switch (def?.type) {
		case 'string':
			return { type: 'string' };
		case 'number':
			return { type: 'number' };
		case 'int':
			return { type: 'integer' };
		case 'boolean':
			return { type: 'boolean' };
		case 'date':
			return { type: 'string', format: 'date-time' };
		case 'literal':
			return {
				const:
					(def as { values?: unknown[]; value?: unknown }).value ??
					(def as { values?: unknown[] }).values?.[0]
			};
		case 'enum':
			return {
				enum: Object.values(
					(def as { entries?: Record<string, string | number> }).entries ?? {}
				) as Array<string | number>
			};
		case 'array': {
			const element = (def as { element?: z.ZodType }).element;
			return {
				type: 'array',
				items: element
					? (getJsonSchemaFromRuntime(element, io) ?? { type: 'object', additionalProperties: true })
					: {}
			};
		}
		case 'object': {
			const shape = (def as { shape?: Record<string, z.ZodType> }).shape ?? {};
			const properties: Record<string, JsonSchema> = Object.fromEntries(
				Object.entries(shape).map(([key, child]) => [
					key,
					getJsonSchemaFromRuntime(child, io) ?? { type: 'object', additionalProperties: true }
				])
			);
			return { type: 'object', properties };
		}
		case 'union': {
			const options = (def as { options?: z.ZodType[] }).options ?? [];
			return {
				oneOf: options.map(
					(option) =>
						getJsonSchemaFromRuntime(option, io) ?? { type: 'object', additionalProperties: true }
				)
			};
		}
		case 'nullable': {
			const inner = (def as { innerType?: z.ZodType }).innerType;
			return (
				nullableSchema(inner ? (getJsonSchemaFromRuntime(inner, io) ?? undefined) : undefined) ??
				{ type: ['null'] }
			);
		}
		case 'optional':
		case 'default':
		case 'readonly': {
			const inner = (def as { innerType?: z.ZodType }).innerType;
			return inner
				? (getJsonSchemaFromRuntime(inner, io) ?? { type: 'object', additionalProperties: true })
				: { type: 'object', additionalProperties: true };
		}
		case 'pipe': {
			const pipeDef = def as { in?: z.ZodType; out?: z.ZodType };
			const inner = io === 'input' ? pipeDef.in : pipeDef.out;
			return inner
				? (getJsonSchemaFromRuntime(inner, io) ?? { type: 'object', additionalProperties: true })
				: { type: 'object', additionalProperties: true };
		}
		case 'transform':
			return { type: 'object', additionalProperties: true };
		default:
			return { type: 'object', additionalProperties: true };
	}
}

async function collectRouteFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry): Promise<string[]> => {
			const fullPath = path.join(directory, entry.name);
			if (entry.isDirectory()) return collectRouteFiles(fullPath);
			return entry.isFile() && entry.name === '+server.ts' ? [fullPath] : [];
		})
	);
	return nested.flat();
}

function extractOpenApiOverrides(sourceText: string): OpenApiOverrides {
	const overrides: OpenApiOverrides = {
		pathItem: null,
		operations: {},
		ignore: false
	};

	for (const block of extractOpenApiBlocks(sourceText)) {
		const override = parseOpenApiOverride(block.content);
		if (!override) continue;
		if (shouldIgnoreOpenApiOverride(override)) {
			overrides.ignore = true;
			continue;
		}

		const method = inferOpenApiMethod(block, sourceText);
		if (!method) {
			overrides.pathItem = mergeOpenApi(overrides.pathItem ?? {}, override);
			continue;
		}

		overrides.operations[method] = mergeOpenApi(overrides.operations[method] ?? {}, override);
	}

	return overrides;
}

function extractOpenApiBlocks(sourceText: string): Array<{ content: string; endIndex: number }> {
	const matches = sourceText.matchAll(/@openapi\s+([\s\S]*?)\*\//g);
	return Array.from(matches, (match) => ({
		content: match[1] ?? '',
		endIndex: match.index! + match[0].length
	}));
}

function parseOpenApiOverride(content: string): Record<string, unknown> | null {
	const yamlSource = content
		.split('\n')
		.map((line) => line.replace(/^\s*\* ?/, ''))
		.join('\n')
		.trim();

	if (!yamlSource) return null;
	const parsed = parseYaml(yamlSource);
	return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
}

function inferOpenApiMethod(block: { endIndex: number }, sourceText: string): HttpMethod | null {
	const trailingSource = sourceText.slice(block.endIndex);
	const exportMatch = trailingSource.match(
		/^\s*export\s+(?:const|function)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/m
	);
	return (exportMatch?.[1] as HttpMethod | undefined) ?? null;
}

function shouldIgnoreOpenApiOverride(override: Record<string, unknown> | null): boolean {
	return override?.ignore === true;
}

function mergeOpenApi<T>(base: T, override: unknown): T {
	if (!override || typeof override !== 'object' || Array.isArray(override))
		return (override as T) ?? base;
	if (!base || typeof base !== 'object' || Array.isArray(base)) return override as T;

	const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
	for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
		const current = result[key];
		if (Array.isArray(value)) {
			result[key] =
				key === 'parameters' && Array.isArray(current)
					? mergeOpenApiParameters(current, value)
					: value;
			continue;
		}
		if (
			value &&
			typeof value === 'object' &&
			current &&
			typeof current === 'object' &&
			!Array.isArray(current)
		) {
			result[key] = mergeOpenApi(current, value);
			continue;
		}
		result[key] = value;
	}
	return result as T;
}

function mergeOpenApiParameters(base: unknown[], override: unknown[]): unknown[] {
	const result = [...base];
	for (const parameter of override) {
		if (!isParameterObject(parameter)) {
			result.push(parameter);
			continue;
		}

		const index = result.findIndex(
			(current) =>
				isParameterObject(current) && current.name === parameter.name && current.in === parameter.in
		);
		if (index === -1) {
			result.push(parameter);
			continue;
		}

		result[index] = mergeOpenApi(result[index], parameter);
	}
	return result;
}

function isParameterObject(value: unknown): value is Pick<ParameterObject, 'name' | 'in'> {
	return (
		Boolean(value) &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		typeof (value as { name?: unknown }).name === 'string' &&
		typeof (value as { in?: unknown }).in === 'string'
	);
}

function visit(node: ts.Node, callback: (node: ts.Node) => void) {
	callback(node);
	node.forEachChild((child) => visit(child, callback));
}

function getPropertyName(name: ts.PropertyName): string | null {
	if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name))
		return name.text;
	return null;
}
