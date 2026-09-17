<script lang="ts">
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import SwordsIcon from '@lucide/svelte/icons/swords';
	import { resolve } from '$app/paths';
	import { TIER_LABELS } from '$lib/access';
	import { staffNav, visibleNav } from '$lib/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The same filter the shell applies, so the dashboard lists exactly the
	// sections this visitor may open. Cosmetic, not authorization: each route is
	// guarded by the layout that owns it.
	const sections = $derived(
		visibleNav(staffNav, data.access.tier).filter((item) => item.href !== resolve('/staff'))
	);
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<h1 class="h2">Staff area</h1>
		<p class="max-w-prose opacity-80">
			Everything here is gated by the GM level on the game accounts linked to your profile. The
			level is read from AzerothCore on every request, so a change to it applies the next time you
			load a page.
		</p>
	</header>

	<section
		class="flex flex-col gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
	>
		<div class="flex items-center gap-3">
			<ShieldIcon class="size-6 text-primary-500" />
			<h2 class="h5">Your access</h2>
		</div>

		<div class="flex flex-wrap items-baseline gap-2">
			<span class="badge preset-filled-primary-500">{TIER_LABELS[data.access.tier]}</span>
			<span class="text-sm opacity-70">gmlevel {data.access.level}</span>
		</div>

		<p class="text-sm opacity-80">
			This is the highest level across your linked game accounts. It comes from
			<code>acore_auth.account_access</code>, which AzerothCore owns — this site only reads it. A
			change is live here immediately; the game server may keep its own copy until it reloads.
		</p>
	</section>

	<section class="flex flex-col gap-4">
		<h2 class="h4">Your linked game accounts</h2>

		{#if data.accounts.length === 0}
			<p
				class="card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm opacity-80"
			>
				No game account is linked to this profile, so there is no GM level to read — which is why
				this page is the only staff page you can open. Link an account from
				<a class="anchor" href={resolve('/accounts')}>Game Accounts</a> to restore the rest.
			</p>
		{:else}
			<ul class="flex list-none flex-col gap-3">
				{#each data.accounts as account (account.username)}
					<li
						class="flex flex-wrap items-center justify-between gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-4"
					>
						<div class="flex items-center gap-3">
							<SwordsIcon class="size-5 text-primary-500" />
							<span class="font-medium">{account.username}</span>
						</div>

						{#if account.level > 0}
							<span class="badge preset-filled-success-500">gmlevel {account.level}</span>
						{:else}
							<span class="badge preset-tonal-warning">no staff level</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if sections.length > 0}
		<section class="flex flex-col gap-4">
			<h2 class="h4">Open to your level</h2>

			<!--
				`item.href` was passed through `resolve()` once, where the nav data is
				defined in `$lib/navigation`. The navigation rule cannot see that through
				a variable, so the block is disabled rather than resolving a path that is
				already resolved — or, worse, hardcoding one.
			-->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<ul class="grid list-none gap-3 sm:grid-cols-2">
				{#each sections as item (item.href)}
					{@const Icon = item.icon}
					<li>
						<a
							href={item.href}
							class="flex items-center gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-4 hover:preset-tonal"
						>
							<Icon class="size-5 text-primary-500" />
							<span class="font-medium">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</section>
	{/if}
</div>
