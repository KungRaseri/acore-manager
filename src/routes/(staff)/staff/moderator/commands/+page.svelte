<script lang="ts">
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import CommandBrowser from '$lib/components/commands/CommandBrowser.svelte';
	import CommandOutput from '$lib/components/commands/CommandOutput.svelte';
	import { TIER_LABELS } from '$lib/access';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Nullable in one place, so the template narrows once instead of reading through `form?`.
	const run = $derived(form?.run ?? null);
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<h1 class="h2">Command console</h1>
		<p class="max-w-prose opacity-80">
			Every command this realm declares, read from its own <code>command</code> table with the gmlevel
			each one asks for. The page opens at gmlevel 1; what you may actually run is decided per command
			against your own level, and a command above it stays listed rather than hidden.
		</p>
		<p class="max-w-prose text-sm opacity-80">
			Commands run through the site's <strong>console account</strong>, never as your own character
			— so what one does is bounded by what the realm lets that account do, and by what the realm
			supports from a console with no selected player. Every attempt is written to the audit trail
			before anything is sent, refusals included, and the console's reply is truncated at 2000
			characters rather than kept whole.
		</p>
	</header>

	{#if run}
		<CommandOutput
			ok={run.ok}
			message={run.message}
			output={run.output}
			truncated={run.truncated}
			auditId={run.auditId}
			recorded={run.recorded}
		/>
	{/if}

	{#if data.catalogue.message}
		<!-- The realm's table could not be read, or is empty: said plainly, with nothing runnable
		     and no fallback list, because a second source of truth for an access decision is the
		     thing this project forbids. -->
		<section
			class="flex gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm"
		>
			<TriangleAlertIcon class="mt-0.5 size-5 shrink-0" />
			<p>{data.catalogue.message}</p>
		</section>
	{:else}
		<section class="flex flex-col gap-2">
			<div class="flex items-center gap-3">
				<TerminalIcon class="size-6 text-primary-500" />
				<h2 class="h5">This realm's commands</h2>
			</div>
			<p class="max-w-prose text-sm opacity-80">
				You reach {TIER_LABELS[data.access.tier]} — gmlevel {data.access.level}. A command's own
				gmlevel, as the realm declares it, is what decides whether you may run it.
			</p>
		</section>

		<CommandBrowser entries={data.catalogue.entries} access={data.access} />
	{/if}
</div>
