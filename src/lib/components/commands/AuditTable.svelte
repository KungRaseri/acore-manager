<script lang="ts">
	import { MAX_AUDIT_OUTPUT_CHARS } from '$lib/gm-commands';

	/*
		The row shape is declared here rather than imported from the route, because the
		route's interface lives in a server-only module and a component must not import
		one — not even for a type. This is what the table renders, and the load is written
		to satisfy it.
	*/
	interface AuditRow {
		id: string;
		actorName: string;
		actorLevel: number;
		command: string;
		arguments: string | null;
		status: string;
		failureReason: string | null;
		message: string | null;
		output: string | null;
		outputTruncated: boolean;
		durationMs: number | null;
		createdAt: string;
		finishedAt: string | null;
	}

	let { rows }: { rows: AuditRow[] } = $props();

	/*
		`status` and `failure_reason` are varchars rather than enums (see `db/schema.ts`),
		so a row can hold a token this build has never seen. Unknown values get the neutral
		badge and print as they were stored: a forensic table must not quietly reclassify a
		row into a status someone recognises.
	*/
	const STATUS_BADGES: Record<string, string> = {
		success: 'badge preset-tonal-success',
		failed: 'badge preset-tonal-error',
		refused: 'badge preset-tonal-warning',
		pending: 'badge preset-tonal-surface'
	};

	const statusBadge = (status: string): string =>
		STATUS_BADGES[status] ?? 'badge preset-tonal-surface';

	/** A duration of zero is a real measurement, so only `null` renders as absent. */
	const duration = (ms: number | null): string => (ms === null ? '—' : `${ms} ms`);
</script>

<!--
	Tables are Skeleton's styles for native table elements, not a component: the wrapper
	class gives the horizontal scroll a wide forensic table needs, and the zebra class
	keeps rows followable across six columns.
-->
<div class="table-wrap card border border-surface-200-800 preset-filled-surface-100-900 p-2">
	<table class="table table-zebra">
		<thead>
			<tr>
				<th>When</th>
				<th>Actor</th>
				<th>Command</th>
				<th>Status</th>
				<th>Duration</th>
				<th>Outcome</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.id)}
				<tr>
					<td>
						<!--
							ISO 8601 in UTC, exactly as the load wrote it. A forensic timestamp must not
							move with a reader's locale or timezone, and `<time datetime>` keeps the
							machine-readable value beside the human one.
						-->
						<time datetime={row.createdAt} class="font-mono text-xs">{row.createdAt}</time>
					</td>

					<td>
						<span class="flex flex-col items-start gap-1">
							<span class="font-medium">{row.actorName}</span>
							<span class="badge preset-tonal-surface">gmlevel {row.actorLevel}</span>
						</span>
					</td>

					<td>
						<span class="flex flex-col items-start gap-1">
							<code class="font-mono text-xs">{row.command}</code>
							{#if row.arguments}
								<span class="font-mono text-xs opacity-70">{row.arguments}</span>
							{:else}
								<span class="text-xs opacity-70">no arguments</span>
							{/if}
						</span>
					</td>

					<td>
						<span class="flex flex-col items-start gap-1">
							<span class={statusBadge(row.status)}>{row.status}</span>
							{#if row.failureReason}
								<span class="font-mono text-xs opacity-70">{row.failureReason}</span>
							{/if}
						</span>
					</td>

					<td>
						<span class="font-mono text-xs">{duration(row.durationMs)}</span>
					</td>

					<td class="max-w-md">
						{#if row.status === 'pending' && row.finishedAt === null}
							<!-- The row that never finished is the one a reader would misread as a failure. -->
							<p class="text-xs">
								<strong>No outcome was ever recorded.</strong> A row that is still
								<code>pending</code> means something was attempted and the process died between sending
								the command and writing the result, so this is not a report of failure — and not a report
								that nothing happened either.
							</p>
						{:else if row.status === 'refused'}
							<p class="text-xs">
								<strong>Refused by this site before anything was sent.</strong> The console never saw
								this command, so nothing on the realm changed:
							</p>
							<p class="text-xs opacity-80">{row.message ?? 'No reason was recorded.'}</p>
						{:else if row.message}
							<p class="text-xs opacity-80">{row.message}</p>
						{/if}

						{#if row.output}
							<!-- The console's own words, kept exactly as the writer stored them. -->
							<pre
								class="mt-2 max-h-40 overflow-auto pre rounded-base p-2 text-xs">{row.output}</pre>
						{:else if row.status === 'success'}
							<!-- An empty box would look like a rendering fault; the console page says
							     this in the same words, so the two pages cannot describe the same reply
							     differently. -->
							<p class="mt-2 text-xs opacity-70">The console replied with nothing.</p>
						{/if}

						{#if row.outputTruncated}
							<!--
								The limit is named rather than implied: a reply that simply stops looks like a
								reply that ended, and the audit row lost the same tail.
							-->
							<p class="mt-1 text-xs opacity-70">
								This reply reached the {MAX_AUDIT_OUTPUT_CHARS}-character limit, so its tail was
								never stored — not here and not in the table.
							</p>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
