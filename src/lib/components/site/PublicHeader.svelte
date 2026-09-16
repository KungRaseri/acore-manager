<script lang="ts">
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { CurrentUser } from '$lib/user';
	import BrandMark from './BrandMark.svelte';
	import ModeToggle from './ModeToggle.svelte';
	import UserMenu from './UserMenu.svelte';

	interface Props {
		user: CurrentUser | null;
	}

	let { user }: Props = $props();
</script>

<AppBar class="sticky top-0 z-30 border-b border-surface-200-800">
	<AppBar.Toolbar class="mx-auto w-full max-w-6xl grid-cols-[auto_1fr_auto]">
		<AppBar.Lead>
			<BrandMark />
		</AppBar.Lead>

		<AppBar.Headline>
			<!-- One link today. It becomes a loop over data once a second public
			     page exists; `page` is imported for that. -->
			<nav class="hidden justify-center gap-1 sm:flex" aria-label="Site">
				<a
					href={resolve('/')}
					class="btn preset-tonal-primary"
					aria-current={page.url.pathname === resolve('/') ? 'page' : undefined}
				>
					Home
				</a>
			</nav>
		</AppBar.Headline>

		<AppBar.Trail class="justify-end">
			<ModeToggle />
			{#if user}
				<a href={resolve('/dashboard')} class="btn hidden preset-filled-primary-500 sm:inline-flex">
					Dashboard
				</a>
				<UserMenu {user} />
			{:else}
				<a href={resolve('/login')} class="btn preset-filled-primary-500">Sign in</a>
			{/if}
		</AppBar.Trail>
	</AppBar.Toolbar>
</AppBar>
