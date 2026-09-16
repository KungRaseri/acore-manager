<script lang="ts">
	import { resolve } from '$app/paths';
	import SwordsIcon from '@lucide/svelte/icons/swords';

	interface Props {
		/** Drop the wordmark, keeping only the mark — used where space is tight. */
		compact?: boolean;
	}

	let { compact = false }: Props = $props();
</script>

<a href={resolve('/')} class="flex shrink-0 items-center gap-3">
	<span class="grid size-9 place-items-center rounded-base preset-filled-primary-500">
		<SwordsIcon class="size-5" />
	</span>
	{#if !compact}
		<span class="flex flex-col leading-tight">
			<span class="h5">Azeroth</span>
			<span class="text-xs tracking-widest uppercase opacity-60">Server Manager</span>
		</span>
	{/if}
</a>
