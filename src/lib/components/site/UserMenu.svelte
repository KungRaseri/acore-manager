<script lang="ts">
	import { Avatar, Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { Separator } from 'bits-ui';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth-client';
	import type { CurrentUser } from '$lib/user';

	interface Props {
		user: CurrentUser;
	}

	let { user }: Props = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	const initials = $derived(
		user.name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part.charAt(0).toUpperCase())
			.join('') || '?'
	);

	// Clear a failed sign-out on its own; the menu is closed by then, so the
	// message is rendered as a page-level alert rather than inside the menu.
	$effect(() => {
		if (!error) {
			return;
		}

		const timer = setTimeout(() => (error = null), 8000);

		return () => clearTimeout(timer);
	});

	async function signOut() {
		busy = true;
		error = null;

		try {
			const { error: signOutError } = await authClient.signOut();

			if (signOutError) {
				error = signOutError.message ?? 'Sign out failed.';
				return;
			}

			// The session is a cookie that hooks.server.ts reads into
			// `locals`, so the layout data has to be refetched before leaving —
			// otherwise the shell still renders this user.
			await invalidateAll();
			await goto(resolve('/login'));
		} catch {
			error = 'Sign out failed. Check your connection and try again.';
		} finally {
			busy = false;
		}
	}
</script>

<!--
	Selection is handled on the root: Zag reports the chosen item's `value`
	there (`MenuProps.onSelect`), while an individual `Menu.Item` only carries
	`value`/`disabled`/`closeOnSelect`. Attaching a click handler to the item
	instead would fight the machine for the same event.
-->
<Menu
	onSelect={(details) => {
		if (details.value === 'sign-out') {
			void signOut();
		}
	}}
>
	<Menu.Trigger class="btn-icon btn-icon-lg hover:preset-tonal" aria-label="Account menu">
		<Avatar class="size-8">
			<Avatar.Image src={user.image ?? undefined} alt="" />
			<Avatar.Fallback class="text-xs">{initials}</Avatar.Fallback>
		</Avatar>
	</Menu.Trigger>
	<Portal>
		<Menu.Content>
			<div class="px-2">
				<p class="font-medium">{user.name}</p>
				<p class="text-xs opacity-70">{user.email}</p>
			</div>
			<Separator.Root class="block h-px w-full bg-surface-200-800" />
			<Menu.Item value="sign-out" disabled={busy}>
				<LogOutIcon class="size-4" />
				<Menu.ItemText>{busy ? 'Signing out…' : 'Sign out'}</Menu.ItemText>
			</Menu.Item>
		</Menu.Content>
	</Portal>
</Menu>

{#if error}
	<div
		role="alert"
		class="fixed right-4 bottom-4 z-50 max-w-sm card preset-filled-error-500 p-3 text-sm shadow-lg"
	>
		{error}
	</div>
{/if}
