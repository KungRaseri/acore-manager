<script lang="ts">
	import { siDiscord } from 'simple-icons';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<section class="mx-auto w-full max-w-md px-6 py-16">
	<div
		class="flex flex-col gap-6 card border border-surface-200-800 preset-filled-surface-100-900 p-8"
	>
		<div class="flex flex-col gap-2">
			<h1 class="h3">Sign in</h1>
			<p class="text-sm opacity-80">
				acore-manager identifies you through Discord — that account is the only credential you need.
			</p>
		</div>

		{#if form?.error}
			<p role="alert" class="card preset-filled-error-500 p-3 text-sm">{form.error}</p>
		{/if}

		<form method="POST">
			<button type="submit" class="btn w-full justify-center preset-filled-primary-500 btn-lg">
				<!-- Simple Icons is the brand-mark source; Discord is a brand, so this
				     is the one place an inline SVG belongs. -->
				<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
					<path d={siDiscord.path} />
				</svg>
				Continue with Discord
			</button>
		</form>
	</div>
</section>
