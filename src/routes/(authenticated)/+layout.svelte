<script lang="ts">
	import AppShell from '$lib/components/site/AppShell.svelte';
	import { mainNav, staffNav, visibleNav } from '$lib/navigation';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<AppShell user={data.user} main={mainNav} staff={visibleNav(staffNav, data.access.tier)}>
	{@render children()}
</AppShell>
