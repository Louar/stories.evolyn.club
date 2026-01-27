import z from 'zod/v4';


export const schemaToRegister = z.object({
  email: z.email(`Je e-mailadres is ongeldig.`),
  password: z.string(`Een wachtwoord is vereist.`).min(5, `Je wachtwoord moet minimaal 5 tekens bevatten.`),
  passwordConfirm: z.string(`Ook een wachtwoordbevestiging is vereist.`).min(1, `Ook een wachtwoordbevestiging is vereist.`),
  firstName: z.string(`Een voornaam is verplicht.`).min(1, `Een voornaam is verplicht.`).max(128, `Je voornaam mag maximaal 128 tekens lang zijn.`),
  lastName: z.string().max(128, `Je achternaam mag maximaal 128 tekens lang zijn.`).optional(),
}).refine(({ password, passwordConfirm }) => password == passwordConfirm, { error: `Wachtwoorden komen niet overeen.`, path: ['passwordConfirm'] });

export const schemaToAuthenticate = z.object({
  email: z.email(`Je e-mailadres is ongeldig.`),
  password: z.string(`Een wachtwoord is vereist.`).min(5, `Je wachtwoord moet minimaal 5 tekens bevatten.`),
});
