import { json } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { RequestHandler } from './$types';

const SPECIFICATION_FILE = path.resolve('static/generated/openapi-specification.yaml');

/**
 * @openapi
 * ignore: true
 */
export const GET: RequestHandler = async () => {
	const yaml = await readFile(SPECIFICATION_FILE, 'utf8');
	const specification = parseYaml(yaml, { maxAliasCount: -1 });

	return json(specification);
};
