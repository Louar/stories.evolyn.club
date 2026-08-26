import type { RequestHandler } from './$types';


/**
 * @openapi
 * ignore: true
 */
export const GET = (async ({ url, locals, request, params, fetch }) => {
  const uid = locals.authusr!.id;
  const endpoint = params.endpoint;

  return await fetch(`/api/users/${uid}/${endpoint}${url.search}`, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // @ts-expect-error Node fetch option
    duplex: 'half'
  });
}) satisfies RequestHandler;

/**
 * @openapi
 * ignore: true
 */
export const POST = (async ({ url, locals, request, params, fetch }) => {
  const uid = locals.authusr!.id;
  const endpoint = params.endpoint;

  return await fetch(`/api/users/${uid}/${endpoint}${url.search}`, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // @ts-expect-error Node fetch option
    duplex: 'half'
  });
}) satisfies RequestHandler;

/**
 * @openapi
 * ignore: true
 */
export const PUT = (async ({ url, locals, request, params, fetch }) => {
  const uid = locals.authusr!.id;
  const endpoint = params.endpoint;

  return await fetch(`/api/users/${uid}/${endpoint}${url.search}`, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // @ts-expect-error Node fetch option
    duplex: 'half'
  });
}) satisfies RequestHandler;

/**
 * @openapi
 * ignore: true
 */
export const DELETE = (async ({ url, locals, request, params, fetch }) => {
  const uid = locals.authusr!.id;
  const endpoint = params.endpoint;

  return await fetch(`/api/users/${uid}/${endpoint}${url.search}`, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // @ts-expect-error Node fetch option
    duplex: 'half'
  });
}) satisfies RequestHandler;
