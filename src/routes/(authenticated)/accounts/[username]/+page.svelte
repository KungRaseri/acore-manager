<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import SwordsIcon from '@lucide/svelte/icons/swords';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { resolve } from '$app/paths';
	import { formatMoney, formatPlaytime, formatTimestamp } from '$lib/characters';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<a class="btn w-fit preset-tonal-primary btn-sm" href={resolve('/accounts')}>
			<ChevronLeftIcon class="size-4" />
			Game accounts
		</a>
		<h1 class="h2">{data.account.username}</h1>
		<p class="max-w-prose opacity-80">
			{#if data.account.email === ''}
				This account carries no email address, so it is on this page because it is linked to your
				profile.
			{:else}
				Registered to <span class="font-medium">{data.account.email}</span>.
			{/if}
		</p>
	</header>

	<section class="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">Characters</p>
			<p class="h4">{data.totals.count}</p>
		</div>
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">Highest level</p>
			<p class="h4">{data.totals.highestLevel}</p>
		</div>
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">Total playtime</p>
			<p class="h4">{formatPlaytime(data.totals.totalTime)}</p>
		</div>
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">Across all characters</p>
			<p class="h4">{formatMoney(data.totals.money)}</p>
		</div>
	</section>

	<section class="flex flex-col gap-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="h4">Characters</h2>
			{#if data.totals.online > 0}
				<span class="badge preset-filled-success-500">{data.totals.online} online now</span>
			{/if}
		</div>

		{#if data.characters.length === 0}
			<p
				class="card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm opacity-80"
			>
				This account has no characters on the realm yet. Create one in game and it will appear here.
			</p>
		{:else}
			<ul class="flex list-none flex-col gap-3">
				{#each data.characters as character (character.guid)}
					<li>
						<a
							class="flex flex-col gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-4 hover:preset-tonal"
							href={resolve('/(authenticated)/accounts/[username]/characters/[guid]', {
								username: data.account.username,
								guid: String(character.guid)
							})}
						>
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="flex items-center gap-2">
									<SwordsIcon class="size-5 text-primary-500" />
									<span class="h5">{character.name}</span>
								</div>

								<div class="flex flex-wrap items-center gap-2">
									{#if character.online}
										<span class="badge preset-filled-success-500">Online</span>
									{:else}
										<span class="badge preset-tonal-surface">Offline</span>
									{/if}
									<span class="text-sm opacity-80">
										{character.level}
										{character.raceName}
										{character.className}
									</span>
								</div>
							</div>

							<dl class="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
								<div class="flex gap-2">
									<dt class="opacity-60">Guild</dt>
									<dd>
										{#if character.guildName}
											{character.guildName}{#if character.guildRankName}
												· {character.guildRankName}{/if}
										{:else}
											<span class="opacity-60">none</span>
										{/if}
									</dd>
								</div>
								<div class="flex gap-2">
									<dt class="opacity-60">Where</dt>
									<dd>{character.zoneName ?? 'unknown'}</dd>
								</div>
								<div class="flex gap-2">
									<dt class="opacity-60">Played</dt>
									<dd>{formatPlaytime(character.totalTime)}</dd>
								</div>
								<div class="flex gap-2">
									<dt class="opacity-60">Money</dt>
									<dd>{formatMoney(character.money)}</dd>
								</div>
								<div class="flex gap-2">
									<dt class="opacity-60">Last seen</dt>
									<dd>{formatTimestamp(character.logoutTime)}</dd>
								</div>
								<div class="flex gap-2">
									<dt class="opacity-60">Created</dt>
									<dd>{formatTimestamp(character.createdAt)}</dd>
								</div>
							</dl>
						</a>
					</li>
				{/each}
			</ul>
			<p class="text-xs opacity-70">
				"Online" is the server's own last known state, and it can lag behind a worldserver that
				stopped without logging out.
			</p>
		{/if}
	</section>

	{#if data.deleted.length > 0}
		<section class="flex flex-col gap-4">
			<div class="flex items-center gap-2">
				<TrashIcon class="size-5 text-warning-500" />
				<h2 class="h4">Deleted characters</h2>
			</div>

			<p class="max-w-prose text-sm opacity-80">
				AzerothCore keeps a deleted character in the database rather than removing it, so a game
				master can still restore it. These can no longer be selected in game.
			</p>

			<ul class="flex list-none flex-col gap-2">
				{#each data.deleted as character (character.guid)}
					<li
						class="flex flex-wrap items-center justify-between gap-2 card border border-surface-200-800 preset-filled-surface-100-900 p-3 text-sm"
					>
						<span class="font-medium">{character.name}</span>
						<span class="opacity-80">
							{character.level}
							{character.raceName}
							{character.className}
						</span>
						<span class="opacity-60">deleted {formatTimestamp(character.deletedAt)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
