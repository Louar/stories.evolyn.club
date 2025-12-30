import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { vite as vidstack } from 'vidstack/plugins';
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';

export default defineConfig({ plugins: [tailwindcss(), vidstack(), sveltekit(), devtoolsJson()] });
