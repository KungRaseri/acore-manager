<script lang="ts">
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import { resolve } from '$app/paths';
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<h1 class="h2">Administration</h1>
		<p class="max-w-prose opacity-80">
			Open from gmlevel 3, the level the worldserver's own console demands. This folder's layout
			declares that floor, and it is the highest in the staff area.
		</p>
	</header>

	<section
		class="flex flex-col gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
	>
		<div class="flex items-center gap-3">
			<WrenchIcon class="size-6 text-primary-500" />
			<h2 class="h5">What is open at this level</h2>
		</div>

		<p class="text-sm opacity-80">
			The <a class="anchor" href={resolve('/staff/admin/audit')}>audit trail</a> is here: every console
			command attempt the site has recorded, newest first, with the actor, the arguments and the console's
			own reply. It is administrator-only because it aggregates every staff member's attempts, and it
			is read-only — no page edits, deletes, prunes or exports a row.
		</p>

		<p class="text-sm opacity-80">
			Running the commands is not here. The box lives at
			<a class="anchor" href={resolve('/staff/moderator/commands')}>Command console</a>, open from
			gmlevel 1, because a command browser's softest audience is a moderator — and what a visitor
			may run there is decided per command, in the action that sends it.
		</p>

		<p class="text-sm opacity-80">
			Read-only diagnostics stay one tier lower, at
			<a class="anchor" href={resolve('/staff/gm')}>Server Diagnostics</a>, because seeing the state
			of the server is a different privilege from changing it.
		</p>
	</section>

	<section
		class="flex flex-col gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
	>
		<div class="flex items-center gap-3">
			<ShieldAlertIcon class="size-6 text-primary-500" />
			<h2 class="h5">What has to be true first</h2>
		</div>

		<ul class="flex list-disc flex-col gap-1 pl-5 text-sm opacity-80">
			<li><code>SOAP.Enabled = 1</code> in <code>worldserver.conf</code>.</li>
			<li>The console account holds <code>SEC_ADMINISTRATOR</code>.</li>
			<li>
				Commands are logged: the trail records the intent before anything is sent and the outcome
				after, and a refusal is recorded too.
			</li>
		</ul>
	</section>
</div>
