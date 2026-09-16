import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { svelteTesting } from '@testing-library/svelte/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-node: this app is deployed as a Node server (see Dockerfile),
			// where `node build/index.js` is the runtime entrypoint.
			// Set ORIGIN to the browser-facing origin, or cross-origin form posts are rejected.
			adapter: adapter(),

			typescript: {
				config: (config) => {
					// Single app: these live next to this file, not a level up.
					config.include.push('./drizzle.config.ts', './vitest-setup-client.ts');
				}
			}
		}),
		// Test-only helper: sets the browser resolve conditions and unmounts
		// components between tests. Replaced the old Vitest browser mode.
		svelteTesting({ autoCleanup: true })
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					// jsdom, not a real browser: no Playwright browsers needed for unit tests.
					environment: 'jsdom',
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
