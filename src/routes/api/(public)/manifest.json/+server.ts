import type { RequestHandler } from './$types';


export const GET = (async ({ locals }) => {

  const camelToSnake = (str: string) => str.replace(/([A-Z])/g, '_$1').toLowerCase();

  const transform = (obj: unknown): unknown => {
    if (Array.isArray(obj)) {
      return obj.map(transform);
    } else if (obj !== null && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc: Record<string, unknown>, [key, value]) => {
        const newKey = camelToSnake(key);
        acc[newKey] = transform(value);
        return acc;
      }, {});
    }
    return obj;
  }

  const manifest = transform(locals.client.manifest || {});

  return new Response(JSON.stringify(manifest), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) satisfies RequestHandler;
