import { z } from 'zod/v4';

export const authenticationSchema = z.object({
	email: z.email(`Je e-mailadres is ongeldig.`),
	password: z.string(`Een wachtwoord is vereist.`).min(5, `Je wachtwoord moet minimaal 5 tekens bevatten.`),
});
