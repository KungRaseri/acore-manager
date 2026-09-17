import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TIER_LABELS, tierAtLeast, type AccessTier } from '../access';

/**
 * The route tree under `/staff` has one rule that the code cannot state by
 * itself: **the folder name is the floor**, and every folder containing a page
 * declares that floor on its own layout.
 *
 * The reason it needs a test is the shape of the tree. The group layout carries
 * the *weakest* rule (moderator), so a folder added with no layout of its own
 * would inherit it silently — a page the author meant to be administrator-only
 * would be open to a moderator, and nothing would say so. This spec is the
 * tripwire for that: it is a check on the source text, not a proof, and it is
 * written to fail loudly rather than to reason about what the code does.
 *
 * See `plans/gm-level-gating.md` for the design.
 */

/** Folders named for a tier, and the floor their name implies. */
const TIER_FOLDERS: Record<string, AccessTier> = {
	moderator: 'moderator',
	gm: 'game-master',
	admin: 'administrator'
};

/** The helpers a folder layout may declare, and the tier each one enforces. */
const REQUIRE_HELPERS: Record<string, AccessTier> = {
	requireStaff: 'moderator',
	requireGameMaster: 'game-master',
	requireServerManager: 'administrator'
};

/** `src/routes/(staff)`, resolved from this file rather than the working directory. */
const staffGroup = fileURLToPath(new URL('../../../src/routes/(staff)', import.meta.url));
const staffRoot = join(staffGroup, 'staff');

/** The floors a layout declares, by the helpers it names. */
function declaredFloors(source: string): AccessTier[] {
	return Object.entries(REQUIRE_HELPERS)
		.filter(([helper]) => source.includes(helper))
		.map(([, tier]) => tier);
}

/**
 * Walks one folder, collecting problems and the folders actually inspected.
 *
 * `label` is the URL path rather than the directory name, because that is what a
 * reader of the failure message needs to look at.
 */
function inspect(
	dir: string,
	label: string,
	floor: AccessTier,
	problems: string[],
	inspected: string[]
): void {
	if (existsSync(join(dir, '+page.svelte'))) {
		inspected.push(label);

		const layout = join(dir, '+layout.server.ts');

		if (!existsSync(layout)) {
			problems.push(
				`${label} has a page but no +layout.server.ts, so it silently inherits ${floor}`
			);
		} else {
			const declared = declaredFloors(readFileSync(layout, 'utf8'));

			if (declared.length !== 1) {
				problems.push(
					`${label} must name exactly one require* helper on its layout, but names ${declared.length}`
				);
			} else if (!tierAtLeast(declared[0], floor)) {
				problems.push(
					`${label} declares ${TIER_LABELS[declared[0]]} on its layout, below what its folder name implies (${floor})`
				);
			}
		}
	}

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}

		const named = TIER_FOLDERS[entry.name];

		if (named && !tierAtLeast(named, floor)) {
			// A tier-named folder may only tighten its parent's floor. Naming one
			// for a lower tier is a mistake, and the subtree keeps the stricter
			// floor while the problem is reported.
			problems.push(
				`${label}/${entry.name} is named below its parent's floor (${named} < ${floor})`
			);
			inspected.push(`${label}/${entry.name}`);

			continue;
		}

		inspect(join(dir, entry.name), `${label}/${entry.name}`, named ?? floor, problems, inspected);
	}
}

describe('staff route floors', () => {
	it('declares a floor on every folder that has a page', () => {
		const problems: string[] = [];
		const inspected: string[] = [];

		inspect(staffRoot, '/staff', 'moderator', problems, inspected);

		// A walk that found nothing would pass vacuously, so the folders that must
		// exist are asserted first.
		expect(inspected).toEqual(
			expect.arrayContaining(['/staff', '/staff/moderator', '/staff/gm', '/staff/admin'])
		);
		expect(problems).toEqual([]);
	});

	it('names each tier folder after the floor it implies', () => {
		const unnamed = readdirSync(staffRoot, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && !(entry.name in TIER_FOLDERS))
			.map((entry) => entry.name);

		expect(unnamed).toEqual([]);
	});

	it('declares the group floor on the group layout', () => {
		const groupLayout = readFileSync(join(staffGroup, '+layout.server.ts'), 'utf8');

		expect(groupLayout).toContain('requireStaff');
	});
});
