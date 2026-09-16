<script lang="ts">
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import SwordsIcon from '@lucide/svelte/icons/swords';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-8">
	<header class="flex flex-col gap-2">
		<h1 class="h2">Game accounts</h1>
		<p class="max-w-prose opacity-80">
			Accounts on your AzerothCore realm, linked to this profile. The same name and password work in
			the game client — this site does not add a second password to remember.
		</p>
	</header>

	{#if form?.result}
		<div
			role={form.result.ok ? 'status' : 'alert'}
			class="flex items-start gap-3 card border p-4 text-sm {form.result.ok
				? 'border-success-500/40 preset-tonal-success'
				: 'border-error-500/40 preset-tonal-error'}"
		>
			{#if form.result.ok}
				<CircleCheckIcon class="mt-0.5 size-5 shrink-0" />
			{:else}
				<TriangleAlertIcon class="mt-0.5 size-5 shrink-0" />
			{/if}
			<p>{form.result.message}</p>
		</div>
	{/if}

	<section class="flex flex-col gap-4">
		<h2 class="h4">Linked accounts</h2>

		{#if data.accounts.length === 0}
			<p
				class="card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm opacity-80"
			>
				No game accounts are linked to this profile yet. Create one below, or link an account you
				already play on.
			</p>
		{:else}
			<ul class="flex list-none flex-col gap-3">
				{#each data.accounts as account (account.id)}
					<li
						class="flex flex-wrap items-center justify-between gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-4"
					>
						<div class="flex items-center gap-3">
							<SwordsIcon class="size-5 text-primary-500" />
							<div class="flex flex-col">
								<span class="font-medium">{account.username}</span>
								<span class="text-xs opacity-70">Linked {account.linkedOn}</span>
							</div>
						</div>
						<form method="POST" action="?/unlink">
							<input type="hidden" name="accountId" value={account.id} />
							<button
								type="submit"
								class="btn preset-outlined-error-500 btn-sm"
								aria-label="Unlink {account.username}"
							>
								Unlink
							</button>
						</form>
					</li>
				{/each}
			</ul>
			<p class="text-xs opacity-70">
				Unlinking only removes the link. The game account, its characters and its password stay
				exactly as they are.
			</p>
		{/if}
	</section>

	<div class="grid gap-4 lg:grid-cols-2">
		<section
			class="flex flex-col gap-4 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
		>
			<div class="flex flex-col gap-1">
				<h2 class="h5">Create a game account</h2>
				<p class="text-sm opacity-80">
					The server creates the account for you. Letters and numbers only for the name; the
					password must be 8-16 characters with no spaces.
				</p>
			</div>

			<form method="POST" action="?/create" class="flex flex-col gap-4">
				<label class="label">
					<span class="label-text">Account name</span>
					<input
						class="input"
						name="username"
						type="text"
						required
						minlength="3"
						maxlength="17"
						autocomplete="off"
						placeholder="e.g. Thrall"
					/>
				</label>

				<label class="label">
					<span class="label-text">Password</span>
					<input
						class="input"
						name="password"
						type="password"
						required
						minlength="8"
						maxlength="16"
						autocomplete="new-password"
					/>
				</label>

				<button type="submit" class="mt-2 btn justify-center preset-filled-primary-500">
					Create account
				</button>
			</form>
		</section>

		<section
			class="flex flex-col gap-4 card border border-surface-200-800 preset-filled-surface-100-900 p-6"
		>
			<div class="flex flex-col gap-1">
				<h2 class="h5">Link an existing account</h2>
				<p class="text-sm opacity-80">
					Already play on this realm? Enter that account's own name and password. Nothing is changed
					on the account — the password is only checked against the server's stored credentials.
				</p>
			</div>

			<form method="POST" action="?/link" class="flex flex-col gap-4">
				<label class="label">
					<span class="label-text">Account name</span>
					<input
						class="input"
						name="username"
						type="text"
						required
						maxlength="17"
						autocomplete="off"
					/>
				</label>

				<label class="label">
					<span class="label-text">Password</span>
					<input class="input" name="password" type="password" required autocomplete="off" />
				</label>

				<button type="submit" class="mt-2 btn justify-center preset-outlined-primary-500">
					Link account
				</button>
			</form>
		</section>
	</div>
</div>
