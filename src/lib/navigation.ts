import { resolve } from '$app/paths';
import { tierAtLeast, type AccessTier } from '$lib/access';
import type { Component } from 'svelte';
import ActivityIcon from '@lucide/svelte/icons/activity';
import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';
import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
import ShieldIcon from '@lucide/svelte/icons/shield';
import SwordsIcon from '@lucide/svelte/icons/swords';
import TerminalIcon from '@lucide/svelte/icons/terminal';
import WrenchIcon from '@lucide/svelte/icons/wrench';

/**
 * Navigation is data, not markup: every app shell (sidebar, mobile drawer)
 * renders from these arrays, so a route only ever has to be described once and
 * the active-item rule lives in one place.
 */
export interface NavItem {
	label: string;
	/** Already passed through `resolve()`, so consumers render it unchanged. */
	href: string;
	icon: Component;
	/**
	 * By default an item is active when the pathname matches it exactly or sits
	 * beneath it (so `/accounts` stays active on `/accounts/new`). Set this for
	 * parents whose children are separate destinations — `/staff` must not light
	 * up while the user is on `/staff/gm`.
	 */
	exact?: boolean;
	/**
	 * The lowest tier that may see this item.
	 *
	 * Required rather than defaulted, so every item states its floor and a new
	 * one cannot be added without answering the question. A href the visitor
	 * cannot open is worse than a missing one: it advertises a 403.
	 */
	minTier: AccessTier;
}

/** Routes for any signed-in player. */
export const mainNav: NavItem[] = [
	{
		label: 'Dashboard',
		href: resolve('/dashboard'),
		icon: LayoutDashboardIcon,
		exact: true,
		minTier: 'player'
	},
	{ label: 'Game Accounts', href: resolve('/accounts'), icon: SwordsIcon, minTier: 'player' }
];

/**
 * The staff area, as one section whose items are filtered by tier.
 *
 * These are *not* authorization: the group and folder layouts under
 * `src/routes/(staff)` enforce the floors, and this list only decides what is
 * worth showing. The two must agree — a route's floor is stated in its layout,
 * and the spec in `$lib/server/staff-routes.spec.ts` fails the build when a
 * folder under `/staff` forgets to declare one.
 */
export const staffNav: NavItem[] = [
	{
		label: 'Staff Home',
		href: resolve('/staff'),
		icon: ShieldIcon,
		exact: true,
		minTier: 'moderator'
	},
	{
		label: 'Moderation',
		href: resolve('/staff/moderator'),
		icon: ShieldCheckIcon,
		// Exact, because the command console beneath it is its own entry below:
		// otherwise this item and that one would light up together.
		exact: true,
		minTier: 'moderator'
	},
	{
		/*
			The console sits in the moderator folder because a command browser's *softest*
			audience is a moderator. What a visitor may actually run is decided per command,
			against the level the realm declares and their own GM level, inside the action.
		*/
		label: 'Command console',
		href: resolve('/staff/moderator/commands'),
		icon: TerminalIcon,
		minTier: 'moderator'
	},
	{
		label: 'Server Diagnostics',
		href: resolve('/staff/gm'),
		icon: ActivityIcon,
		exact: true,
		minTier: 'game-master'
	},
	{
		label: 'Administration',
		href: resolve('/staff/admin'),
		icon: WrenchIcon,
		exact: true,
		minTier: 'administrator'
	},
	{
		/*
			The trail is administrator-only because it aggregates every staff member's
			attempts, and its rows name accounts, players and reasons. No moderator sees this
			link, and the route it points at refuses one anyway.
		*/
		label: 'Audit trail',
		href: resolve('/staff/admin/audit'),
		icon: ScrollTextIcon,
		minTier: 'administrator'
	}
];

/**
 * The items a visitor at `tier` may see.
 *
 * Used by the group layouts, which pass the result to the shell: a component
 * cannot import `$lib/server`, so the filtering has to happen in the load.
 */
export function visibleNav(items: readonly NavItem[], tier: AccessTier): NavItem[] {
	return items.filter((item) => tierAtLeast(tier, item.minTier));
}

export function isNavActive(pathname: string, item: NavItem): boolean {
	if (item.exact) {
		return pathname === item.href;
	}

	return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
