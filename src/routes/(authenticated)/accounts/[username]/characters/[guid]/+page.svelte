<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import { resolve } from '$app/paths';
	import {
		formatGender,
		formatMoney,
		formatPlaytime,
		formatTimestamp,
		qualityClass,
		slotLabel
	} from '$lib/characters';
	import ItemIcon from '$lib/components/characters/ItemIcon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<a
			class="btn w-fit preset-tonal-primary btn-sm"
			href={resolve('/(authenticated)/accounts/[username]', {
				username: data.account.username
			})}
		>
			<ChevronLeftIcon class="size-4" />
			{data.account.username}
		</a>

		<div class="flex flex-wrap items-center gap-3">
			<h1 class="h2">{data.character.name}</h1>
			{#if data.character.online}
				<span class="badge preset-filled-success-500">Online</span>
			{:else}
				<span class="badge preset-tonal-surface">Offline</span>
			{/if}
		</div>

		<p class="max-w-prose opacity-80">
			{data.character.level}
			{data.character.raceName}
			{data.character.className}
			· {formatGender(data.character.gender)}
			{#if data.character.alliance !== null}
				· {data.character.alliance ? 'Alliance' : 'Horde'}
			{/if}
			{#if data.character.guildName}
				· {data.character.guildName}{#if data.character.guildRankName}
					({data.character.guildRankName}){/if}
			{/if}
		</p>
	</header>

	<section class="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3">
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">Total playtime</p>
			<p class="h5">{formatPlaytime(data.character.totalTime)}</p>
		</div>
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">At level {data.character.level}</p>
			<p class="h5">{formatPlaytime(data.character.levelTime)}</p>
		</div>
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">Money</p>
			<p class="h5">{formatMoney(data.character.money)}</p>
		</div>
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">Zone</p>
			<p class="h5">{data.character.zoneName ?? 'unknown'}</p>
		</div>
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">Last seen</p>
			<p class="h5">{formatTimestamp(data.character.logoutTime)}</p>
		</div>
		<div class="card border border-surface-200-800 preset-filled-surface-100-900 p-4">
			<p class="text-xs opacity-70">Created</p>
			<p class="h5">{formatTimestamp(data.character.createdAt)}</p>
		</div>
	</section>

	<section class="flex flex-col gap-4">
		<h2 class="h4">Equipped</h2>

		{#if data.equipped.length === 0}
			<p
				class="card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm opacity-80"
			>
				Nothing equipped.
			</p>
		{:else}
			<ul class="grid list-none gap-2 sm:grid-cols-2">
				{#each data.equipped as item (item.slot)}
					<li
						class="flex items-center gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-3"
					>
						<!-- The texture comes from the client's MPQ archives, extracted into
						     static/interface/Icons and served from this site; the component
						     falls back to a placeholder when a file is not there. -->
						<ItemIcon url={item.iconUrl} />

						<div class="flex min-w-0 flex-col">
							<span class="truncate font-medium {qualityClass(item.quality)}">{item.name}</span>
							<span class="text-xs opacity-70">
								{slotLabel(item.slot)}{#if item.itemLevel !== null}
									· item level {item.itemLevel}{/if}
								{#if item.count > 1}
									· ×{item.count}
								{/if}
							</span>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="flex flex-col gap-4">
		<h2 class="h4">Skills</h2>

		{#if data.skills.length === 0}
			<p
				class="card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm opacity-80"
			>
				No trained skills recorded.
			</p>
		{:else}
			<ul class="grid list-none gap-2 sm:grid-cols-2">
				{#each data.skills as skill (skill.skill)}
					<li
						class="flex items-center justify-between gap-3 card border border-surface-200-800 preset-filled-surface-100-900 px-3 py-2 text-sm"
					>
						<span>{skill.name}</span>
						<span class="opacity-70">{skill.value} / {skill.max}</span>
					</li>
				{/each}
			</ul>
			<p class="text-xs opacity-70">
				Professions appear alongside weapon, armour and language skills: the server's own skill
				category table is not shipped in the world database, so there is nothing authoritative to
				group them by here.
			</p>
		{/if}
	</section>
</div>
