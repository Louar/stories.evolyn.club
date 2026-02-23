import { Language } from '$lib/db/schemas/0-utils';

export const UI: {
  language: Language | 'default';
}
  = $state({
    language: 'default',
  });
