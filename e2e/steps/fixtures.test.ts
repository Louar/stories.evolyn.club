import { expect } from '@playwright/test';
import { test as base, createBdd } from 'playwright-bdd';


const adminAlex = {
  email: process.env.SECRET_DEFAULT_USER_EMAIL ?? '?',
  password: process.env.SECRET_DEFAULT_USER_PASSWORD ?? '?'
};
const participantPascal = {
  email: 'participant-pascal@core.eu',
  password: 'temporary-password'
};

const withUniqueEmailFragment = (email: string) => {
  const [localPart, domain] = email.split('@');
  return `${localPart}+${crypto.randomUUID().slice(0, 8)}@${domain}`;
};


type Fixtures = {
  authenticateAdminAlex: () => Promise<{ token: string }>;
  authenticateParticipantPascal: () => Promise<{ id: string }>;
  loginAsParticipantPascal: () => Promise<void>;
};

export const test = base.extend<Fixtures>({
  authenticateAdminAlex: async ({ request }, use) => {
    await use(async () => {
      const response = await request.post(`/api/auth`, {
        data: {
          email: adminAlex.email,
          password: adminAlex.password,
        }
      });
      expect(response.ok()).toBeTruthy();
      return await response.json();
    });
  },
  authenticateParticipantPascal: async ({ request }, use) => {
    const email = withUniqueEmailFragment(participantPascal.email);
    const created = await request.post(`/api/auth/register`, {
      data: {
        email,
        password: participantPascal.password,
      }
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();

    await use(async () => ({ id }));

    const deleted = await request.delete(`/api/users/${id}`);
    expect(deleted.ok()).toBeTruthy();
  },
  loginAsParticipantPascal: async ({ request, page }, use) => {
    const email = withUniqueEmailFragment(participantPascal.email);
    const created = await request.post(`/api/auth/register`, {
      data: {
        email,
        password: participantPascal.password,
      }
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();

    await use(async () => {
      await page.goto('/auth');

      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/password|wachtwoord/i).fill(participantPascal.password);
      await page.getByRole('button', { name: /login|inloggen|sign in/i }).click();

      await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
      await expect(page).not.toHaveURL(/\/auth/);
    });

    const deleted = await request.delete(`/api/users/${id}`);
    expect(deleted.ok()).toBeTruthy();
  },
});

export const { Given, When, Then, Before, After } = createBdd(test);
