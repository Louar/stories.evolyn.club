import { Given } from './fixtures.test';

Given('Participant Pascal is authenticated through the API', async ({ authenticateParticipantPascal }) => {
	await authenticateParticipantPascal();
});

Given('Participant Pascal is logged in through the UI', async ({ loginAsParticipantPascal }) => {
	await loginAsParticipantPascal();
});
