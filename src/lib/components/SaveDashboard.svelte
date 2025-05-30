<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { goto } from '$app/navigation';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { DisplayConfig } from '$lib/server/types/display.types';

	let {
		query,
		display,
		explanation,
		dataSourceId
	}: {
		query: string;
		display: DisplayConfig[];
		explanation: string;
		dataSourceId: string;
	} = $props();

	// State
	let name = $state('');
	let open = $state(false);
	let isSaving = $state(false);
	let errorMessage = $state('');

	// Save dashboard to the server
	async function saveDashboard() {
		if (!name.trim()) {
			errorMessage = 'Please enter a name for your dashboard';
			return;
		}

		isSaving = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/dashboards', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name,
					query,
					items: display.map((item) => ({ ...item, layout: item, id: undefined })),
					dataSourceId,
					explanation
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to save dashboard');
			}

			const result = await response.json();

			open = false;
			goto(`/dashboards/${result.dashboard.id}`);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
			console.error('Error saving dashboard:', error);
		} finally {
			isSaving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger type="button" class={buttonVariants({ variant: 'outline' })}
		>Save Dashboard</Dialog.Trigger
	>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Save Dashboard</Dialog.Title>
			<Dialog.Description>
				Give your dashboard a name to save it for future reference.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-4 py-4">
			<div class="grid grid-cols-4 items-center gap-4">
				<Label for="name" class="text-right">Name</Label>
				<Input id="name" bind:value={name} placeholder="My Dashboard" class="col-span-3" />
			</div>

			{#if errorMessage}
				<p class="text-destructive text-sm">{errorMessage}</p>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={saveDashboard} disabled={isSaving}>
				{isSaving ? 'Saving...' : 'Save'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
