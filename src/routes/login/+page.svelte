<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
	<h1 class="text-2xl font-semibold">Sign in</h1>
	<p>acore-manager identifies you through Discord.</p>

	<form method="POST">
		<button type="submit" class="rounded border px-4 py-2 font-medium hover:underline">
			Continue with Discord
		</button>
	</form>

	{#if form?.error}
		<p>{form.error}</p>
	{/if}
</main>
