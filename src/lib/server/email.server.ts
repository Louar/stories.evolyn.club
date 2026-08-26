import { DEFAULT_RESEND_API_KEY } from '$app/env/private';
import { Resend } from 'resend';

export const resend = new Resend(DEFAULT_RESEND_API_KEY);
