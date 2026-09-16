<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import SwordsIcon from '@lucide/svelte/icons/swords';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<h1 class="h2">Welcome back, {data.user.name}</h1>
		<p class="max-w-prose opacity-80">
			This is your starting point for everything tied to your account on this realm.
		</p>
	</header>

	<div class="grid gap-4 sm:grid-cols-2">
		<section
			class="flex flex-col gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
		>
			<SwordsIcon class="size-6 text-primary-500" />
			<h2 class="h5">Game accounts</h2>
			<p class="text-sm opacity-80">
				The accounts you log into the realm with, attached to this Discord identity.
			</p>
			<a href={resolve('/accounts')} class="mt-auto inline-flex items-center gap-1 anchor text-sm">
				Manage game accounts
				<ArrowRightIcon class="size-4" />
			</a>
		</section>

		<section
			class="flex flex-col gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
		>
			<h2 class="h5">Signed in as</h2>
			<dl class="flex flex-col gap-1 text-sm">
				<div class="flex justify-between gap-4">
					<dt class="opacity-70">Display name</dt>
					<dd>{data.user.name}</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="opacity-70">Email</dt>
					<dd class="truncate">{data.user.email}</dd>
				</div>
			</dl>
			<p class="mt-auto text-xs opacity-70">
				Sign-in runs through Discord, so nothing here can be changed from this site.
			</p>
		</section>
	</div>
</div>
