<script lang="ts">
	import { Navigation } from '@skeletonlabs/skeleton-svelte';
	import { page } from '$app/state';
	import { isNavActive, type NavItem } from '$lib/navigation';

	interface Props {
		main: NavItem[];
		admin?: NavItem[];
		/** Invoked when a link is activated — the mobile drawer uses it to close itself. */
		onNavigate?: () => void;
		class?: string;
	}

	let { main, admin = [], onNavigate, class: className = '' }: Props = $props();
</script>

<!--
	One snippet, two groups: the player routes and the server routes differ only
	by which array they render, so the active-item rule stays in `isNavActive`
	and the visual states stay in one place.

	`Navigation.TriggerAnchor` already carries Skeleton's `btn hover:preset-tonal`
	styling; the active item adds the tonal preset on top, and utilities beat the
	component stylesheet's base layer, so the active styling survives hover too.
-->
{#snippet navMenu(items: NavItem[])}
	<Navigation.Menu>
		{#each items as item (item.href)}
			{@const Icon = item.icon}
			{@const active = isNavActive(page.url.pathname, item)}
			<Navigation.TriggerAnchor
				href={item.href}
				aria-current={active ? 'page' : undefined}
				class={active ? 'preset-tonal-primary' : ''}
				onclick={onNavigate}
			>
				<Icon class="size-4" />
				<Navigation.TriggerText>{item.label}</Navigation.TriggerText>
			</Navigation.TriggerAnchor>
		{/each}
	</Navigation.Menu>
{/snippet}

<Navigation layout="sidebar" class={className}>
	<Navigation.Content>
		{#if main.length > 0}
			<Navigation.Group>
				<Navigation.Label>Player</Navigation.Label>
				{@render navMenu(main)}
			</Navigation.Group>
		{/if}

		{#if admin.length > 0}
			<Navigation.Group>
				<Navigation.Label>Server</Navigation.Label>
				{@render navMenu(admin)}
			</Navigation.Group>
		{/if}
	</Navigation.Content>
</Navigation>
