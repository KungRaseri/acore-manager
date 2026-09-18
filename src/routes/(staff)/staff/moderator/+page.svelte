<script lang="ts">
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import { resolve } from '$app/paths';
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<h1 class="h2">Moderation</h1>
		<p class="max-w-prose opacity-80">
			The moderation home, open from gmlevel 1. This folder's own layout declares that floor, so the
			gate sits on the route itself rather than on the link that reaches it.
		</p>
	</header>

	<section
		class="flex flex-col gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
	>
		<div class="flex items-center gap-3">
			<ShieldCheckIcon class="size-6 text-primary-500" />
			<h2 class="h5">The command console is here</h2>
		</div>

		<p class="text-sm opacity-80">
			The <a class="anchor" href={resolve('/staff/moderator/commands')}>command console</a> lists every
			command this realm declares and runs the ones your own level allows. It is the one page in this
			folder with an action, and that action re-checks the level for itself before anything reaches the
			worldserver.
		</p>

		<p class="text-sm opacity-80">
			The rest lands as it is built: player lookups, report review, and the read-only views a
			moderator needs to answer a ticket. Nothing else on this page changes anything on the realm,
			and that is deliberate — a moderator sees; a game master acts. When a moderation tool does
			gain an action, that action declares its own floor, higher than this folder's if the action
			deserves it.
		</p>
	</section>
</div>
