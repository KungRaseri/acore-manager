import { describe, expect, it } from 'vitest';
import {
	formatMoney,
	formatPlaytime,
	formatTimestamp,
	itemIconUrl,
	qualityClass,
	usableIconBase
} from './characters';

describe('formatMoney', () => {
	it('splits copper into gold, silver and copper, dropping empty parts', () => {
		expect(formatMoney(0)).toBe('0c');
		expect(formatMoney(42)).toBe('42c');
		expect(formatMoney(100)).toBe('1s');
		expect(formatMoney(1234)).toBe('12s 34c');
		expect(formatMoney(10_000)).toBe('1g');
		expect(formatMoney(1_234_567)).toBe('123g 45s 67c');
	});

	it('never renders a negative purse', () => {
		expect(formatMoney(-5)).toBe('0c');
	});
});

describe('formatPlaytime', () => {
	it('reads seconds as days, hours and minutes', () => {
		expect(formatPlaytime(59)).toBe('0m');
		expect(formatPlaytime(3600)).toBe('1h');
		expect(formatPlaytime(90_000)).toBe('1d 1h');
		expect(formatPlaytime(1_234_567)).toBe('14d 6h 56m');
	});
});

describe('formatTimestamp', () => {
	it('reads a unix timestamp as UTC, so the server and the browser agree', () => {
		expect(formatTimestamp(1_700_000_000)).toBe('2023-11-14 22:13 UTC');
	});

	it('reports a timestamp that was never written', () => {
		// `characters.logout_time` is 0 until the server has recorded a logout.
		expect(formatTimestamp(0)).toBe('never');
	});
});

describe('qualityClass', () => {
	it('maps item quality onto theme tokens, not literal colors', () => {
		expect(qualityClass(2)).toBe('text-success-500');
		expect(qualityClass(3)).toBe('text-primary-500');
		expect(qualityClass(4)).toBe('text-secondary-500');
	});

	it('leaves common quality unstyled and unknown quality toneless', () => {
		expect(qualityClass(1)).toBe('');
		expect(qualityClass(99)).toBe('');
	});
});

describe('usableIconBase', () => {
	it('falls back to the site default when nothing is configured', () => {
		expect(usableIconBase(undefined)).toBe('/interface/Icons');
		expect(usableIconBase('')).toBe('/interface/Icons');
		expect(usableIconBase('   ')).toBe('/interface/Icons');
	});

	it('accepts a root-relative path and an absolute URL', () => {
		expect(usableIconBase('/interface/Icons')).toBe('/interface/Icons');
		expect(usableIconBase('https://icons.example/large')).toBe('https://icons.example/large');
	});

	it('refuses a filesystem path or a dev-server /@fs/ URL', () => {
		// Either one produces requests a browser or the dev server will refuse,
		// which surfaces only as every icon turning into a placeholder.
		expect(usableIconBase('G:/icons/Icons')).toBe('/interface/Icons');
		expect(usableIconBase('/@fs/G:/code/static/interface/Icons')).toBe('/interface/Icons');
		expect(usableIconBase('interface/Icons')).toBe('/interface/Icons');
	});
});

describe('itemIconUrl', () => {
	it('uses the icon name exactly as the client stores it', () => {
		// The DBC is inconsistently cased and the extracted files match it, so any
		// normalisation here would 404 on a case-sensitive filesystem.
		expect(itemIconUrl('INV_SWORD_107', '/interface/Icons')).toBe(
			'/interface/Icons/INV_SWORD_107.png'
		);
		expect(itemIconUrl('INV_Sword_106', '/interface/Icons')).toBe(
			'/interface/Icons/INV_Sword_106.png'
		);
	});

	it('appends the extension the textures were extracted with', () => {
		expect(itemIconUrl('INV_Misc_Bag_08', '/interface/Icons')).toBe(
			'/interface/Icons/INV_Misc_Bag_08.png'
		);
	});

	it('tolerates a trailing slash on the base', () => {
		expect(itemIconUrl('INV_Sword_01', '/interface/Icons/')).toBe(
			'/interface/Icons/INV_Sword_01.png'
		);
	});

	it('has no URL for an item with no display record', () => {
		expect(itemIconUrl(null, '/interface/Icons')).toBeNull();
	});
});
