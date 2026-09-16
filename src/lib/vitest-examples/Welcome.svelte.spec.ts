import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Welcome from './Welcome.svelte';

describe('Welcome.svelte', () => {
	it('renders greetings for host and guest', () => {
		// In Testing Library for Svelte 5, props are the second argument.
		render(Welcome, { host: 'SvelteKit', guest: 'Vitest' });

		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, SvelteKit!');
		expect(screen.getByText('Hello, Vitest!')).toBeInTheDocument();
	});
});
