<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { Tabs, Pagination } from '@skeletonlabs/skeleton-svelte';
	import { resolve } from '$app/paths';
	import { MAX_AUDIT_OUTPUT_CHARS } from '$lib/gm-commands';
	import AuditTable from '$lib/components/commands/AuditTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/*
		The status filter is cosmetic and stays on this page: `readAuditPage()` reads one
		page of the trail and never the whole history, so a filter that ran on the server
		would have to page *after* filtering to be honest — and it would then need a count
		the reader deliberately does not take. The page says as much where the filter
		appears, so nobody reads "no rows" as "no such event".
	*/
	let statusFilter = $state('all');

	const countStatus = (status: string): number =>
		data.rows.filter((row) => row.status === status).length;

	const visibleRows = $derived(
		statusFilter === 'all' ? data.rows : data.rows.filter((row) => row.status === statusFilter)
	);

	/*
		`readAuditPage()` never counts the table: `hasMore` comes from reading one row past
		the page, so a page render is one index scan and never a `COUNT(*)` over a table
		that is never pruned. `count` is therefore the lowest total consistent with what the
		reader has proved — the pages before this one, this one, and one more when `hasMore`
		says so — which is enough to draw the control without claiming a total nobody read.
	*/
	const paginationCount = $derived(
		(data.page - 1) * data.pageSize + Math.max(data.rows.length, 1) + (data.hasMore ? 1 : 0)
	);

	/*
		A real link rather than a click handler, because Zag's pagination renders anchors in
		`link` mode: `?page=` is a URL the reader sanitises, a middle click and a
		JavaScript-free press both work, and the navigation rule is satisfied with `resolve()`
		doing the path.
	*/
	const pageUrl = ({ page }: { page: number }): string =>
		`${resolve('/staff/admin/audit')}?page=${page}`;

	/** What each status means, in the words a reader needs rather than the column's. */
	const LEGEND: { status: string; badge: string; explanation: string }[] = [
		{
			status: 'success',
			badge: 'badge preset-tonal-success',
			explanation: 'The console answered and this site recorded its reply.'
		},
		{
			status: 'failed',
			badge: 'badge preset-tonal-error',
			explanation:
				'The console refused the command, took too long, or could not be reached. The reason is a token from this site; the message is what the operator saw.'
		},
		{
			status: 'refused',
			badge: 'badge preset-tonal-warning',
			explanation:
				'Refused before anything was sent — a command above the level of the acting profile, a blocked one, or a missing confirmation. No console call was made and the realm was not touched.'
		},
		{
			status: 'pending',
			badge: 'badge preset-tonal-surface',
			explanation:
				'No outcome was ever written. A row that stays pending means the process died between sending the command and recording the result, which is neither a failure nor evidence that nothing happened.'
		}
	];
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<div class="flex items-center gap-3">
			<ScrollTextIcon class="size-6 text-primary-500" />
			<h1 class="h2">Audit trail</h1>
		</div>
		<p class="max-w-prose opacity-80">
			Every console command attempt this site has recorded, newest first. The intent is written
			<em>before</em> anything is sent to the worldserver and the outcome is written after, so an attempt
			that never finished stays visible here instead of vanishing.
		</p>
		<p class="max-w-prose text-sm opacity-80">
			This page is <strong>administrator-only</strong> — gmlevel 3, the floor its layout declares —
			because it aggregates every staff member's attempts and its rows name accounts, players and
			reasons. It is also <strong>read-only</strong>: the trail is append-only, so nothing here
			edits, deletes, prunes or exports a row, and the route has no actions at all.
		</p>
	</header>

	<section
		class="flex flex-col gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
	>
		<div class="flex items-center gap-3">
			<ShieldAlertIcon class="size-6 text-primary-500" />
			<h2 class="h5">How to read this</h2>
		</div>

		<ul class="flex flex-col gap-2 text-sm">
			{#each LEGEND as entry (entry.status)}
				<li class="flex flex-wrap items-baseline gap-2">
					<span class={entry.badge}>{entry.status}</span>
					<span class="max-w-prose opacity-80">{entry.explanation}</span>
				</li>
			{/each}
		</ul>

		<p class="max-w-prose text-sm opacity-80">
			Console output is kept truncated at
			<strong>{MAX_AUDIT_OUTPUT_CHARS} characters</strong>, so a long reply has lost its tail: a row
			whose reply reaches that limit says so, and the missing text was never written down anywhere —
			this table is not a shorter view of something longer.
		</p>

		<p class="max-w-prose text-sm opacity-80">
			Paging reads {data.pageSize} rows at a time, newest first, and the trail is never counted: the page
			numbers reach as far as the reader has confirmed, not as far as the history goes. The status filter
			below narrows the rows on <em>this</em> page only.
		</p>
	</section>

	{#if data.unavailable}
		<!-- An unreadable trail, explained rather than thrown: it is a broken link, not an
		     empty record, and the page must not imply that nothing ever happened. -->
		<section
			class="flex gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm"
		>
			<TriangleAlertIcon class="mt-0.5 size-5 shrink-0" />
			<p>{data.message}</p>
		</section>
	{:else}
		<section class="flex flex-col gap-4">
			<Tabs value={statusFilter} onValueChange={(details) => (statusFilter = details.value)}>
				<Tabs.List>
					<Tabs.Trigger value="all">Everything ({data.rows.length})</Tabs.Trigger>
					<Tabs.Trigger value="success">Success ({countStatus('success')})</Tabs.Trigger>
					<Tabs.Trigger value="failed">Failed ({countStatus('failed')})</Tabs.Trigger>
					<Tabs.Trigger value="refused">Refused ({countStatus('refused')})</Tabs.Trigger>
					<Tabs.Trigger value="pending">Pending ({countStatus('pending')})</Tabs.Trigger>
					<Tabs.Indicator />
				</Tabs.List>
			</Tabs>

			{#if data.rows.length === 0}
				<p
					class="card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm opacity-80"
				>
					{#if data.page > 1}
						This page of the trail is empty, and the trail is read newest-first — so you have walked
						past the oldest row. <a class="anchor" href={resolve('/staff/admin/audit')}
							>Back to the newest rows</a
						>.
					{:else}
						No console command attempt has been recorded yet. The first one appears here as soon as
						somebody runs a command from the console, because the intent row is written before
						anything reaches the worldserver.
					{/if}
				</p>
			{:else if visibleRows.length === 0}
				<p
					class="card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm opacity-80"
				>
					No row on this page holds that status. The filter cannot see the rest of the trail — clear
					it, or walk the pages, to find one.
				</p>
			{:else}
				<AuditTable rows={visibleRows} />
			{/if}

			{#if data.rows.length > 0 || data.page > 1}
				<!--
					Zag's pagination in `link` mode, so the page numbers are real URLs: `?page=` is
					read and sanitised by the load, and the control works with or without
					JavaScript. It is drawn only when there is a page to move to.
				-->
				<div class="flex justify-center">
					<Pagination
						count={paginationCount}
						pageSize={data.pageSize}
						page={data.page}
						type="link"
						getPageUrl={pageUrl}
					>
						<Pagination.PrevTrigger>
							<ArrowLeftIcon class="size-4" />
						</Pagination.PrevTrigger>
						<Pagination.Context>
							{#snippet children(pagination)}
								{#each pagination().pages as page, index (index)}
									{#if page.type === 'page'}
										<Pagination.Item {...page}>{page.value}</Pagination.Item>
									{:else}
										<Pagination.Ellipsis {index}>&#8230;</Pagination.Ellipsis>
									{/if}
								{/each}
							{/snippet}
						</Pagination.Context>
						<Pagination.NextTrigger>
							<ArrowRightIcon class="size-4" />
						</Pagination.NextTrigger>
					</Pagination>
				</div>
			{/if}
		</section>
	{/if}
</div>
