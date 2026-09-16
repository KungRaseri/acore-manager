import { resolve } from '$app/paths';
import type { Component } from 'svelte';
import ActivityIcon from '@lucide/svelte/icons/activity';
import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
import SwordsIcon from '@lucide/svelte/icons/swords';

/**
 * Navigation is data, not markup: every app shell (sidebar, mobile drawer,
 * public header) renders from these arrays, so a route only ever has to be
 * described once and the active-item rule lives in one place.
 */
export interface NavItem {
	label: string;
	/** Already passed through `resolve()`, so consumers render it unchanged. */
	href: string;
	icon: Component;
	/**
	 * By default an item is active when the pathname matches it exactly or sits
	 * beneath it (so `/accounts` stays active on `/accounts/new`). Set this for
	 * parents whose children are separate destinations — `/admin` must not light
	 * up while the user is on `/admin/something-else`.
	 */
	exact?: boolean;
}

/** Routes for any signed-in player. */
export const mainNav: NavItem[] = [
	{ label: 'Dashboard', href: resolve('/dashboard'), icon: LayoutDashboardIcon, exact: true },
	{ label: 'Game Accounts', href: resolve('/accounts'), icon: SwordsIcon }
];

/**
 * Server-management routes, rendered as a separate group.
 *
 * These are *not* authorization: the group is a visual boundary around routes
 * whose layout enforces access. See `src/lib/server/authz.ts`.
 */
export const adminNav: NavItem[] = [
	{ label: 'Server Overview', href: resolve('/admin'), icon: ActivityIcon, exact: true }
];

export function isNavActive(pathname: string, item: NavItem): boolean {
	if (item.exact) {
		return pathname === item.href;
	}

	return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
