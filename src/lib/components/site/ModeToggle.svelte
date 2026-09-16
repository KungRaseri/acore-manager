<script lang="ts">
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';

	/*
		Deliberately stateless.

		The active mode is the presence of the `dark` class on <html>, applied
		before first paint by the inline script in src/app.html. Reading it here
		instead of holding a `$state` copy avoids a server/client mismatch on
		hydration (the server cannot know the visitor's stored preference) and
		keeps a single source of truth. Both icons are rendered and swapped by
		CSS, so nothing has to run on the client to show the right one.
	*/
	const STORAGE_KEY = 'acore-mode';

	function toggleMode() {
		const root = document.documentElement;
		const nextDark = !root.classList.contains('dark');

		root.classList.toggle('dark', nextDark);

		try {
			localStorage.setItem(STORAGE_KEY, nextDark ? 'dark' : 'light');
		} catch {
			// Storage can be unavailable (private mode, blocked cookies). The
			// switch still applies for this page view.
		}
	}
</script>

<button
	type="button"
	class="btn-icon btn-icon-lg hover:preset-tonal"
	aria-label="Toggle color mode"
	onclick={toggleMode}
>
	<SunIcon class="hidden size-5 dark:block" />
	<MoonIcon class="size-5 dark:hidden" />
</button>
