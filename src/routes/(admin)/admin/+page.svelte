<script lang="ts">
	import ActivityIcon from '@lucide/svelte/icons/activity';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<h1 class="h2">Server overview</h1>
		<p class="max-w-prose opacity-80">
			How this website is wired to the AzerothCore servers, and a read-only way to confirm the
			worldserver is answering.
		</p>
	</header>

	<section
		class="flex flex-col gap-4 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
	>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div class="flex items-center gap-3">
				<ActivityIcon class="size-6 text-primary-500" />
				<h2 class="h5">Worldserver console (SOAP)</h2>
			</div>
			{#if data.soapConfigured}
				<span class="badge preset-filled-success-500">Configured</span>
			{:else}
				<span class="badge preset-tonal-warning">Not configured</span>
			{/if}
		</div>

		{#if data.soapConfigured}
			<p class="text-sm opacity-80">
				Calls are made from the server only, one at a time, with a timeout — the worldserver serves
				SOAP on a single thread and would otherwise queue us indefinitely.
			</p>
			<form method="POST" action="?/check" class="flex flex-wrap items-center gap-3">
				<button type="submit" class="btn preset-filled-primary-500">Query server info</button>
				<span class="text-xs opacity-70"
					>Runs <code>.server info</code> and prints the console reply.</span
				>
			</form>

			{#if form?.check}
				{#if form.check.ok}
					<pre class="max-h-80 overflow-auto pre rounded-base p-4 text-xs">{form.check.output}</pre>
				{:else}
					<p role="alert" class="card preset-filled-error-500 p-3 text-sm">{form.check.message}</p>
				{/if}
			{/if}
		{:else}
			<div class="flex gap-3 rounded-base preset-tonal-warning p-4 text-sm">
				<TriangleAlertIcon class="mt-0.5 size-5 shrink-0" />
				<div class="flex flex-col gap-1">
					<p>
						The console is unreachable until <code>ACORE_SOAP_URL</code>,
						<code>ACORE_SOAP_USER</code> and <code>ACORE_SOAP_PASSWORD</code> are set (see
						<code>.env.example</code>), and <code>SOAP.Enabled</code> is on in
						<code>worldserver.conf</code>.
					</p>
					<p class="opacity-80">
						The account must hold <code>SEC_ADMINISTRATOR</code>: SOAP refuses anything lower with a
						403.
					</p>
				</div>
			</div>
		{/if}
	</section>

	<section
		class="flex flex-col gap-2 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
	>
		<h2 class="h5">Why there is no command box</h2>
		<p class="text-sm opacity-80">
			SOAP runs arbitrary console commands against a live realm, and the management area is
			currently open to any signed-in user. A command runner will be added once access is decided by
			the GM level on a linked game account, so the feature cannot be handed out with the gate left
			open.
		</p>
	</section>
</div>
