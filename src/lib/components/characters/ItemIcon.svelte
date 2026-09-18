<script lang="ts">
	import ImageOffIcon from '@lucide/svelte/icons/image-off';

	interface Props {
		/** `null` when the item has no display record at all. */
		url: string | null;
		class?: string;
	}

	let { url, class: className = '' }: Props = $props();

	/*
		Two different things can leave an item without a picture: the world database
		may have no display record for it, or the texture may simply not have been
		extracted (the icon files are Blizzard's artwork, so they are not in the
		repository, and a deployment that does not supply them has none at all).
		Both fall back to the same placeholder instead of the browser's
		broken-image glyph appearing in the middle of a gear list.

		The failed URL is remembered rather than a boolean, so a slot reused for a
		different item tries the new icon rather than inheriting the old failure.
	*/
	let failedUrl = $state<string | null>(null);
	const showIcon = $derived(Boolean(url) && failedUrl !== url);
</script>

{#if showIcon}
	<img
		class="size-10 shrink-0 rounded-base {className}"
		src={url}
		alt=""
		onerror={() => (failedUrl = url)}
	/>
{:else}
	<div
		class="flex size-10 shrink-0 items-center justify-center rounded-base preset-tonal-surface {className}"
	>
		<ImageOffIcon class="size-5" />
	</div>
{/if}
