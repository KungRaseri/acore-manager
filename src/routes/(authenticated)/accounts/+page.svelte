<script lang="ts">
	import SwordsIcon from '@lucide/svelte/icons/swords';
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<div class="flex items-center gap-3">
			<h1 class="h2">Game accounts</h1>
			<span class="badge preset-tonal-warning">In progress</span>
		</div>
		<p class="max-w-prose opacity-80">
			Accounts on your AzerothCore realm, linked to your Discord identity so you keep one login for
			both the game and this site.
		</p>
	</header>

	<section
		class="flex flex-col items-center gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-10 text-center"
	>
		<SwordsIcon class="size-8 opacity-60" />
		<h2 class="h5">No game accounts linked yet</h2>
		<p class="max-w-prose text-sm opacity-80">
			Creating an account on <code>acore_auth</code> and linking it to this profile is the next piece
			of work. Once it lands, this page is where you request an account, pick a username, and see the
			characters that belong to it.
		</p>
		<button type="button" class="btn preset-filled-primary-500" disabled
			>Create a game account</button
		>
	</section>
</div>
