import type { RequestHandler } from './$types';


export const GET = (async ({ locals }) => {

  let variables = '';
  if (locals.client.css) {
    const process = (key: string, value: Record<string, string | unknown> | string | unknown) => {
      if (typeof value === 'string') return `${key}: ${value};`;
      else if (value && typeof value === 'object' && Object.keys(value).length) return ` ${key} { ${Object.entries(value).map(([k, v]): string => process(k, v as Record<string, unknown>)).join('')} } `;
      else return '';
    }

    variables = Object.entries(locals.client.css).map(([key, value]) => process(key, value)).join('');
  }

  return new Response(variables, { status: 200, headers: { 'Content-Type': 'text/css' } });
}) satisfies RequestHandler;
