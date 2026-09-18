<script lang="ts">
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import SwordsIcon from '@lucide/svelte/icons/swords';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { resolve } from '$app/paths';
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
		<h2 class="h4">Your accounts on this realm</h2>

		{#if data.accounts.length === 0}
			<p
				class="card border border-surface-200-800 preset-filled-surface-100-900 p-6 text-sm opacity-80"
			>
				No game account on this realm carries your Discord address yet. Create one below, or link an
				account you already play on.
			</p>
		{:else}
			<p class="text-sm opacity-80">
				Every account on the realm registered to your Discord address, whether or not it was created
				through this site.
			</p>

			<ul class="flex list-none flex-col gap-3">
				{#each data.accounts as account (account.username)}
					<li
						class="flex flex-wrap items-center justify-between gap-3 card border border-surface-200-800 preset-filled-surface-100-900 p-4"
					>
						<div class="flex items-center gap-3">
							<SwordsIcon class="size-5 text-primary-500" />
							<div class="flex flex-col">
								<!-- The account's own page: its characters, and each character in
								     turn. Ownership is proved again there, so this link grants
								     nothing the visitor does not already have. -->
								<a
									class="anchor font-medium"
									href={resolve('/(authenticated)/accounts/[username]', {
										username: account.username
									})}
								>
									{account.username}
								</a>
								<span class="text-xs opacity-70">
									{#if account.email === ''}
										No email on the account
									{:else}
										{account.email}
									{/if}
								</span>
							</div>
						</div>

						{#if account.linked && account.linkId}
							<div class="flex items-center gap-2">
								<span class="badge preset-filled-success-500">Linked</span>
								<form method="POST" action="?/unlink">
									<input type="hidden" name="accountId" value={account.linkId} />
									<button
										type="submit"
										class="btn preset-outlined-error-500 btn-sm"
										aria-label="Unlink {account.username}"
									>
										Unlink
									</button>
								</form>
							</div>
						{:else}
							<form method="POST" action="?/link">
								<!-- No password: the account already carries this profile's
								     Discord address, which is what proving it needs. -->
								<input type="hidden" name="username" value={account.username} />
								<button
									type="submit"
									class="btn preset-outlined-primary-500 btn-sm"
									aria-label="Link {account.username}"
								>
									Link
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="text-xs opacity-70">
				Linking records the account on this profile; it changes nothing on the account itself, and
				unlinking does not touch it either — its characters and password stay exactly as they are.
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
					The server creates the account for you, tied to your Discord address — which is also what
					recovers it later. Letters and numbers only for the name; the password must be 8-16
					characters without spaces.
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

				<!-- The third argument of `account create`, after the password. Disabled
				     on purpose: the address is the signed-in Discord one and can never be
				     something the visitor types, so it is shown for information only and
				     the action reads it from the session. -->
				<label class="label">
					<span class="label-text">Email address</span>
					<input class="input" name="email" type="email" disabled value={data.user.email} />
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
					For an account that was not created here. If it already carries your Discord address, the
					name is enough; otherwise the account's own password proves it is yours. Either way, the
					account's email is then set to your Discord address.
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
					<span class="label-text"
						>Password (only if the account's email is not your Discord address)</span
					>
					<input class="input" name="password" type="password" autocomplete="off" />
				</label>

				<button type="submit" class="mt-2 btn justify-center preset-outlined-primary-500">
					Link account
				</button>
			</form>
		</section>
	</div>
</div>
