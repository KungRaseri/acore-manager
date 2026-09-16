<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ServerIcon from '@lucide/svelte/icons/server';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import SwordsIcon from '@lucide/svelte/icons/swords';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const highlights = [
		{
			icon: SwordsIcon,
			title: 'Game accounts',
			body: 'Request the account you log into the realm with, and keep it attached to your Discord identity.'
		},
		{
			icon: ServerIcon,
			title: 'Server operations',
			body: 'Live status and console tooling for the people running the realm, in one place instead of a terminal.'
		},
		{
			icon: ShieldCheckIcon,
			title: 'One identity',
			body: 'Discord is the only credential. No extra password to forget, rotate, or reuse.'
		}
	];
</script>

<section
	class="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-24"
>
	<div class="flex flex-col items-start gap-6">
		<span class="badge preset-tonal-primary">AzerothCore · 3.3.5a</span>

		<h1 class="h1">Run your realm from one screen.</h1>

		<p class="max-w-prose text-lg opacity-80">
			acore-manager is the website that sits in front of your AzerothCore servers: player accounts,
			character lookups, and the day-to-day operations that would otherwise mean typing console
			commands.
		</p>

		<div class="flex flex-wrap gap-3">
			{#if data.user}
				<a href={resolve('/dashboard')} class="btn preset-filled-primary-500 btn-lg">
					Go to dashboard
					<ArrowRightIcon class="size-4" />
				</a>
			{:else}
				<a href={resolve('/login')} class="btn preset-filled-primary-500 btn-lg">
					Sign in with Discord
					<ArrowRightIcon class="size-4" />
				</a>
			{/if}
		</div>
	</div>

	<ul class="grid list-none gap-4">
		{#each highlights as highlight (highlight.title)}
			{@const Icon = highlight.icon}
			<li
				class="flex flex-col gap-2 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
			>
				<Icon class="size-6 text-primary-500" />
				<h2 class="h5">{highlight.title}</h2>
				<p class="text-sm opacity-80">{highlight.body}</p>
			</li>
		{/each}
	</ul>
</section>
