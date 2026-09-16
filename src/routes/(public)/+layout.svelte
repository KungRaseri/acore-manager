<script lang="ts">
	import PublicHeader from '$lib/components/site/PublicHeader.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="flex min-h-screen flex-col">
	<PublicHeader user={data.user} />

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="border-t border-surface-200-800 px-6 py-4 text-center text-xs">
		<p class="opacity-70">
			acore-manager — server and player management for AzerothCore (World of Warcraft 3.3.5a).
		</p>
	</footer>
</div>
