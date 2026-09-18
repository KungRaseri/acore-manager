<script lang="ts">
	import { Accordion, Tabs } from '@skeletonlabs/skeleton-svelte';
	import type { Access } from '$lib/access';
	import type { GmCommand } from '$lib/gm-commands';
	import CommandRow from './CommandRow.svelte';

	let { entries, access }: { entries: GmCommand[]; access: Access } = $props();

	/*
		The realm's own categories, in the realm's own spelling: a command's name already carries
		its group (`account set gmlevel` is an `account` command), so nothing here invents a
		taxonomy. Every entry stays in the DOM and the filters are display only — searching for a
		command reveals an entry, never a permission.
	*/
	const groupNames = $derived([...new Set(entries.map((entry) => entry.group))].sort());

	let query = $state('');
	let group = $state('all');
	let levelFilter = $state('all');

	const canRun = (entry: GmCommand): boolean => entry.runnable && entry.security <= access.level;

	const runnableCount = $derived(entries.filter(canRun).length);
	const aboveCount = $derived(entries.filter((entry) => entry.security > access.level).length);

	const filtered = $derived(
		entries.filter((entry) => {
			const needle = query.trim().toLowerCase();
			const matchesQuery =
				needle === '' ||
				entry.name.toLowerCase().includes(needle) ||
				entry.description.toLowerCase().includes(needle);
			const matchesGroup = group === 'all' || entry.group === group;
			const matchesLevel =
				levelFilter === 'all' ||
				(levelFilter === 'runnable' ? canRun(entry) : entry.security > access.level);

			return matchesQuery && matchesGroup && matchesLevel;
		})
	);

	const sections = $derived(
		groupNames
			.map((name) => ({ name, commands: filtered.filter((entry) => entry.group === name) }))
			.filter((section) => section.commands.length > 0)
	);
</script>

<section class="flex flex-col gap-4">
	<div class="flex flex-col gap-3">
		<div class="flex flex-wrap items-end gap-3">
			<label class="label min-w-56 flex-1">
				<span class="label-text">Search</span>
				<input
					class="input"
					type="search"
					bind:value={query}
					placeholder="A command name, or a word from its description"
					autocomplete="off"
				/>
			</label>

			<label class="label">
				<span class="label-text">Category</span>
				<select class="select" bind:value={group}>
					<option value="all">All categories</option>
					{#each groupNames as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</label>
		</div>

		<!--
			Tabs is the level filter and nothing else: the catalogue is rendered once, below, driven
			by the selected value. Its own content panes would hold three copies of every command,
			and a realm's table runs to hundreds of rows.
		-->
		<Tabs value={levelFilter} onValueChange={(details) => (levelFilter = details.value)}>
			<Tabs.List>
				<Tabs.Trigger value="all">All listed ({entries.length})</Tabs.Trigger>
				<Tabs.Trigger value="runnable">I can run ({runnableCount})</Tabs.Trigger>
				<Tabs.Trigger value="above">Above my level ({aboveCount})</Tabs.Trigger>
				<Tabs.Indicator />
			</Tabs.List>
		</Tabs>
	</div>

	{#if filtered.length === 0}
		<p
			class="card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm opacity-80"
		>
			No command in this realm's catalogue matches those filters. Clear the search, or widen the
			category or the level, to see the list again.
		</p>
	{:else}
		<Accordion multiple collapsible class="flex flex-col gap-4">
			{#each sections as section (section.name)}
				<div class="flex flex-col gap-2">
					<h3 class="h6 capitalize">{section.name} ({section.commands.length})</h3>

					{#each section.commands as command (command.name)}
						<CommandRow {command} {access} />
					{/each}
				</div>
			{/each}
		</Accordion>
	{/if}
</section>
