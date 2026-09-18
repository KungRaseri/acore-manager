<script lang="ts">
	import BanIcon from '@lucide/svelte/icons/ban';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LockIcon from '@lucide/svelte/icons/lock';
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { TIER_LABELS, type Access, type AccessTier } from '$lib/access';
	import type { CommandRisk, GmCommand } from '$lib/gm-commands';
	import CommandRunner from './CommandRunner.svelte';

	let { command, access }: { command: GmCommand; access: Access } = $props();

	/*
		Two different questions, deliberately kept apart: `runnable` is a property of the entry
		(level 0, above the ladder, or blocked by the overlay) and `permitted` is this visitor's
		own level against the realm's number. Both are shown, and the action asks them again —
		this page's answer only decides what is useful to render.
	*/
	const permitted = $derived(command.runnable && access.level >= command.security);

	const RISK_LABELS: Record<CommandRisk, string> = {
		'read-only': 'Read-only',
		mutating: 'Changes state',
		'realm-affecting': 'Realm-wide',
		blocked: 'Blocked'
	};

	const TIER_BADGES: Record<AccessTier, string> = {
		player: 'badge preset-tonal-surface',
		moderator: 'badge preset-tonal-primary',
		'game-master': 'badge preset-tonal-secondary',
		administrator: 'badge preset-tonal-tertiary'
	};

	// A level the realm declares above the ladder has no tier, and saying "Administrator" for it
	// would claim the site can run it.
	const tierLabel = $derived(
		command.tier
			? `${TIER_LABELS[command.tier]} — gmlevel ${command.security}`
			: `gmlevel ${command.security}`
	);
	const tierBadge = $derived(
		command.tier ? TIER_BADGES[command.tier] : 'badge preset-tonal-surface'
	);
</script>

<Accordion.Item value={command.name} class="card border border-surface-200-800">
	<h3>
		<Accordion.ItemTrigger class="flex w-full items-center justify-between gap-3 p-3 text-left">
			<span class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="flex flex-wrap items-center gap-2">
					<span class="font-mono text-sm font-medium">{command.name}</span>
					<span class={tierBadge}>{tierLabel}</span>
					<span class="badge preset-tonal-surface">{RISK_LABELS[command.risk]}</span>
					{#if !permitted}
						{#if command.runnable}
							<LockIcon class="size-4 opacity-70" />
						{:else}
							<BanIcon class="size-4 opacity-70" />
						{/if}
					{/if}
				</span>

				{#if command.syntax !== ''}
					<span class="truncate font-mono text-xs opacity-70">{command.syntax}</span>
				{:else}
					<span class="text-xs opacity-70">
						The realm's help text declares no syntax for this command.
					</span>
				{/if}
			</span>

			<Accordion.ItemIndicator class="group shrink-0">
				<ChevronDownIcon class="size-4 transition group-data-[state=open]:rotate-180" />
			</Accordion.ItemIndicator>
		</Accordion.ItemTrigger>
	</h3>

	<Accordion.ItemContent class="flex flex-col gap-3 px-3 pb-3 text-sm">
		{#if command.description !== ''}
			<p class="opacity-80">{command.description}</p>
		{/if}

		{#if !command.runnable}
			<div class="flex gap-3 rounded-base preset-tonal-surface p-3 text-xs">
				<BanIcon class="mt-0.5 size-4 shrink-0" />
				<p>{command.note ?? 'This command cannot be run through this site.'}</p>
			</div>
		{:else if !permitted}
			<!-- Shown disabled with the reason rather than hidden: seeing what needs gmlevel 3 is
			     the point of browsing by level, and a forged POST gets a 403 either way. -->
			<div class="flex gap-3 rounded-base preset-tonal-warning p-3 text-xs">
				<LockIcon class="mt-0.5 size-4 shrink-0" />
				<p>
					Needs gmlevel {command.security}; your linked accounts reach {access.level}. The command
					is listed for reference, and the action refuses it while your level is below this one.
				</p>
			</div>
		{:else}
			<h4 class="h6">Run this command</h4>
			<CommandRunner {command} />
		{/if}
	</Accordion.ItemContent>
</Accordion.Item>
