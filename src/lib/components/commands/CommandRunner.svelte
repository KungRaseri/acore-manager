<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import SendIcon from '@lucide/svelte/icons/send';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { Collapsible } from '@skeletonlabs/skeleton-svelte';
	import { enhance } from '$app/forms';
	import { TIER_LABELS } from '$lib/access';
	import {
		MAX_COMMAND_ARGUMENTS,
		policyFor,
		requiresConfirmation,
		type GmCommand
	} from '$lib/gm-commands';

	let { command }: { command: GmCommand } = $props();

	const policy = $derived(policyFor(command.name));
	const needsConfirmation = $derived(requiresConfirmation(command.risk));

	/*
		The typed confirmation is compared here only so a mistyped value never becomes a POST at
		all. The check that counts is the server's, which compares the field against the
		catalogue's own name — a client-side guard is not a guard, and a forged POST is refused
		and audited rather than trusted.
	*/
	let confirmation = $state('');
	let submitting = $state(false);

	const confirmationOk = $derived(
		confirmation.trim() !== '' &&
			confirmation.trim().toLowerCase() === command.name.trim().toLowerCase()
	);

	/*
		The syntax line opens with the command's own name (`Syntax: .kick [$charactername]`), so
		the argument field's hint drops that part when it is there and shows the placeholders
		verbatim otherwise — the realm's own spelling, never a format this site invents.
	*/
	const argumentHint = $derived(
		command.syntax.toLowerCase().startsWith(`.${command.name.toLowerCase()}`)
			? command.syntax.slice(command.name.length + 1).trim()
			: command.syntax
	);
</script>

<form
	method="POST"
	action="?/run"
	class="flex flex-col gap-3 rounded-base preset-tonal-surface p-4"
	use:enhance={() => {
		submitting = true;

		return async ({ update }) => {
			/*
				`reset: false` keeps the arguments and the typed confirmation: a refusal usually
				means one character was wrong, and clearing everything would only make the second
				attempt slower than the first.
			*/
			await update({ reset: false });

			submitting = false;
		};
	}}
>
	<!-- The command's own name, never a console line the browser typed: the action looks the
	     value up in the realm's catalogue and builds the line from what it finds there. -->
	<input type="hidden" name="command" value={command.name} />

	<p class="text-xs opacity-70">
		Requires gmlevel {command.security}{command.tier
			? ` — ${TIER_LABELS[command.tier]}`
			: " — above this site's ladder"}. It runs as the site's console account, not as your own
		character.
	</p>

	{#if command.syntax !== ''}
		<p class="text-xs opacity-70">
			The realm's syntax: <code>{command.syntax}</code>
		</p>
	{/if}

	{#if needsConfirmation}
		<div
			class="flex gap-3 rounded-base p-3 text-xs {command.risk === 'realm-affecting'
				? 'preset-tonal-warning'
				: 'preset-tonal-surface'}"
		>
			<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
			<p>{policy.reason}</p>
		</div>
	{/if}

	{#if command.takesArguments}
		<label class="label">
			<span class="label-text">Arguments</span>
			<input
				class="input font-mono"
				name="arguments"
				type="text"
				maxlength={MAX_COMMAND_ARGUMENTS}
				placeholder={argumentHint}
				autocomplete="off"
			/>
		</label>
	{:else}
		<!-- No field at all rather than an empty one: the realm's syntax declares no arguments,
		     and the action refuses a supplied value for such a command. -->
		<p class="text-xs opacity-70">
			This command takes no arguments — the realm's syntax declares none.
		</p>
	{/if}

	{#if needsConfirmation}
		<!--
			The confirmation step is Skeleton's Collapsible, *inside* the form, so the typed
			value posts with it. It opens by default on purpose: a closed collapsible is hidden
			by an attribute only the client removes, and the form has to work without
			JavaScript — collapsed, a scriptless operator could never reach the field. The
			trigger still lets an operator who is sure put the step away.
		-->
		<Collapsible defaultOpen>
			<Collapsible.Trigger class="group btn w-fit preset-tonal-surface text-xs">
				<TriangleAlertIcon class="size-4" />
				Typed confirmation required
				<ChevronDownIcon class="size-4 transition group-data-[state=open]:rotate-180" />
			</Collapsible.Trigger>

			<Collapsible.Content class="pt-3">
				<label class="label">
					<span class="label-text">Type {command.name} to confirm</span>
					<input
						class="input font-mono"
						name="confirmation"
						type="text"
						bind:value={confirmation}
						placeholder={command.name}
						autocomplete="off"
					/>
				</label>
			</Collapsible.Content>
		</Collapsible>
	{/if}

	<div class="flex flex-wrap items-center gap-3">
		<button
			type="submit"
			class="btn preset-filled-primary-500"
			disabled={submitting || (needsConfirmation && !confirmationOk)}
		>
			{#if submitting}
				<LoaderCircleIcon class="size-4 animate-spin" />
			{:else}
				<SendIcon class="size-4" />
			{/if}
			Run command
		</button>

		<span class="text-xs opacity-70">
			{#if needsConfirmation && !confirmationOk}
				Type the command's name in the confirmation field to enable this button.
			{:else}
				Every attempt is written to the audit trail before anything is sent.
			{/if}
		</span>
	</div>
</form>
