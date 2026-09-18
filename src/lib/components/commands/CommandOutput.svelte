<script lang="ts">
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { MAX_AUDIT_OUTPUT_CHARS } from '$lib/gm-commands';

	/*
		The outcome of one attempt. The fields arrive one by one rather than as the route's
		exported interface, because that interface is declared in a server-only module and a
		component must not import one — not even for a type.
	*/
	let {
		ok,
		message,
		output,
		truncated,
		auditId,
		recorded
	}: {
		ok: boolean;
		message: string;
		output: string;
		truncated: boolean;
		auditId: string | null;
		recorded: boolean;
	} = $props();
</script>

<div
	role={ok ? 'status' : 'alert'}
	class="flex flex-col gap-3 card border p-4 text-sm {ok
		? 'border-success-500/40 preset-tonal-success'
		: 'border-error-500/40 preset-tonal-error'}"
>
	<div class="flex items-start gap-3">
		{#if ok}
			<CircleCheckIcon class="mt-0.5 size-5 shrink-0" />
			<p>The command reached the worldserver.</p>
		{:else}
			<TriangleAlertIcon class="mt-0.5 size-5 shrink-0" />
			<p>{message}</p>
		{/if}
	</div>

	{#if output !== ''}
		<pre class="max-h-80 overflow-auto pre rounded-base p-4 text-xs">{output}</pre>
	{:else if ok}
		<p class="text-xs opacity-70">The console replied with nothing.</p>
	{/if}

	{#if truncated}
		<!-- The limit is named rather than implied: a reply that simply stops looks like a
		     reply that ended, and the audit row lost the same tail. -->
		<p class="text-xs opacity-80">
			The console's reply was longer than {MAX_AUDIT_OUTPUT_CHARS} characters, so it is truncated here
			and in the audit trail — the missing tail is not recorded anywhere.
		</p>
	{/if}

	{#if ok && !recorded}
		<!-- `recorded` is only meaningful after a run, which is why this is not shown for a
		     refusal: a refused attempt carries false too, but its refusal row *is* the record. -->
		<p class="text-xs opacity-80">
			The audit trail does not hold this outcome. The command had already run by the time the write
			failed, so the server's log is the only record of what it did.
		</p>
	{/if}

	{#if auditId}
		<p class="text-xs opacity-70">Audit row <code>{auditId}</code>.</p>
	{/if}
</div>
