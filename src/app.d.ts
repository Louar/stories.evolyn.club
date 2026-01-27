import { findOneAuthenticatedUser, findOneClientByOrigin } from '$lib/db/repositories/1-client-user-module';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			client: Awaited<ReturnType<typeof findOneClientByOrigin>>;
			authusr?: Awaited<ReturnType<typeof findOneAuthenticatedUser>>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export { };
