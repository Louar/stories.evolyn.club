import { db } from '$lib/db/database';
import { UserRole } from '$lib/db/schemas/1-client-user-module';
import ResetPasswordEmail from '$lib/emails/reset-password.svelte';
import { createEmailRenderer } from '$lib/server/email-renderer.server';
import { resend } from '$lib/server/email.server';
import { hashPasswordResetCode } from '$lib/server/password-reset.server';
import { hasPermission, requireParam } from '$lib/server/utils.server';
import { toPlainText } from '@better-svelte-email/server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const RESET_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * @openapi
 * summary: Send password reset email
 * tags:
 *  - Authentication
 */
export const POST: RequestHandler = async ({ fetch, locals, params, url }) => {
	const clientId = locals.client.id;
	const userId = requireParam(params.userId, 'The user parameter is required');
	if (
		!(await hasPermission(locals, {
			elevatedRoles: [UserRole.editor, UserRole.admin]
		}))
	) {
		throw error(403, 'You are not allowed to send password reset emails');
	}

	const administrationEmail = locals.client.administrationEmail?.trim();
	if (!administrationEmail) throw error(422, 'The client administration email is not configured');

	const user = await db
		.selectFrom('user')
		.where('user.id', '=', userId)
		.where('user.clientId', '=', clientId)
		.select(['user.id', 'user.email', 'user.firstName', 'user.lastName'])
		.executeTakeFirst();
	if (!user) throw error(404, 'The user does not exist');
	if (!user.email?.trim()) throw error(422, 'The user does not have an email address');

	const resetCode = crypto.randomUUID();
	const resetCodeHash = await hashPasswordResetCode(resetCode);
	const expiresAt = new Date(Date.now() + RESET_EXPIRATION_MS);
	const resetUrl = new URL(`/auth/reset/${encodeURIComponent(resetCode)}`, url.origin).href;
	const stylesResponse = await fetch('/api/styles.css');
	if (!stylesResponse.ok) throw error(500, 'The client email styles could not be loaded');

	const logo = locals.client.logo;
	const logoUrl =
		logo?.collection && logo.filename
			? new URL(
				`/api/media/${encodeURIComponent(logo.collection)}/${encodeURIComponent(logo.filename)}`,
				url.origin
			).href
			: undefined;
	const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
	const renderer = createEmailRenderer(await stylesResponse.text());
	const html = await renderer.render(ResetPasswordEmail, {
		props: {
			clientName: locals.client.name,
			administrationEmail,
			resetUrl,
			name,
			logoUrl
		}
	});

	await db
		.updateTable('user')
		.where('user.id', '=', user.id)
		.where('user.clientId', '=', clientId)
		.set({
			passwordResetCode: resetCodeHash,
			passwordResetExpiresAt: expiresAt,
			updatedAt: new Date(),
			updatedBy: locals.authusr!.id
		})
		.executeTakeFirstOrThrow();

	const clearResetCode = () =>
		db
			.updateTable('user')
			.where('user.id', '=', user.id)
			.where('user.clientId', '=', clientId)
			.where('user.passwordResetCode', '=', resetCodeHash)
			.set({ passwordResetCode: null, passwordResetExpiresAt: null })
			.execute();

	try {
		const senderName = locals.client.name.replace(/["\\<>\r\n]/g, '').trim();
		const result = await resend.emails.send({
			from: senderName ? `${senderName} <${administrationEmail}>` : administrationEmail,
			to: user.email,
			subject: `Reset your ${locals.client.name} password`,
			html,
			text: toPlainText(html),
			replyTo: administrationEmail
		});

		if (result.error) {
			throw error(
				502,
				result.error.message || 'The email provider rejected the password reset email'
			);
		}
	} catch (sendError) {
		await clearResetCode();
		throw sendError;
	}

	return json({ sent: true });
};
