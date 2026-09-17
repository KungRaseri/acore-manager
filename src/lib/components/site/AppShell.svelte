<script lang="ts">
	import { AppBar } from '@skeletonlabs/skeleton-svelte';
	import { Dialog } from 'bits-ui';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import XIcon from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import type { NavItem } from '$lib/navigation';
	import type { CurrentUser } from '$lib/user';
	import BrandMark from './BrandMark.svelte';
	import ModeToggle from './ModeToggle.svelte';
	import SiteNav from './SiteNav.svelte';
	import UserMenu from './UserMenu.svelte';

	interface Props {
		user: CurrentUser;
		main: NavItem[];
		staff?: NavItem[];
		/** Shown in the top bar on wide screens — usually the current page name. */
		title?: string;
		children: Snippet;
	}

	let { user, main, staff = [], title, children }: Props = $props();

	// The narrow-viewport drawer. `Dialog` here is Bits UI, not Skeleton's Dialog:
	// this is a plain side panel with no Skeleton counterpart, so the headless
	// primitive is the right tool and the classes below are ours.
	let drawerOpen = $state(false);
</script>

<div class="flex min-h-screen flex-col">
	<AppBar class="sticky top-0 z-30 border-b border-surface-200-800">
		<!-- Skeleton's toolbar is a grid with no default column template, so the
		     three tracks are ours to declare. -->
		<AppBar.Toolbar class="grid-cols-[auto_1fr_auto]">
			<AppBar.Lead class="flex items-center gap-2">
				<Dialog.Root bind:open={drawerOpen}>
					<Dialog.Trigger
						class="btn-icon btn-icon-lg hover:preset-tonal lg:hidden"
						aria-label="Open navigation"
					>
						<MenuIcon class="size-5" />
					</Dialog.Trigger>
					<Dialog.Portal>
						<Dialog.Overlay class="fixed inset-0 z-40 bg-surface-950/60" />
						<Dialog.Content
							class="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-surface-100-900 p-4 shadow-xl"
						>
							<div class="mb-4 flex items-center justify-between gap-2">
								<Dialog.Title class="h5">Navigation</Dialog.Title>
								<Dialog.Close class="btn-icon hover:preset-tonal" aria-label="Close navigation">
									<XIcon class="size-5" />
								</Dialog.Close>
							</div>
							<Dialog.Description class="sr-only">
								Links to the pages available to your account.
							</Dialog.Description>
							<SiteNav {main} {staff} onNavigate={() => (drawerOpen = false)} />
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog.Root>
				<BrandMark />
			</AppBar.Lead>

			<AppBar.Headline class="hidden text-center lg:block">
				{#if title}
					<p class="h5">{title}</p>
				{/if}
			</AppBar.Headline>

			<AppBar.Trail class="justify-end">
				<ModeToggle />
				<UserMenu {user} />
			</AppBar.Trail>
		</AppBar.Toolbar>
	</AppBar>

	<div class="flex flex-1">
		<aside class="hidden shrink-0 lg:block">
			<!-- h-full keeps the sidebar's background reaching the bottom of the
			     page on routes whose content is shorter than the viewport. -->
			<SiteNav {main} {staff} class="h-full min-h-full" />
		</aside>
		<main class="min-w-0 flex-1 p-4 lg:p-8">{@render children()}</main>
	</div>
</div>
