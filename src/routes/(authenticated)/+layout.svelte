<script lang="ts">
	import AppShell from '$lib/components/site/AppShell.svelte';
	import { adminNav, mainNav } from '$lib/navigation';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<AppShell user={data.user} main={mainNav} admin={data.showAdminNav ? adminNav : []}>
	{@render children()}
</AppShell>
