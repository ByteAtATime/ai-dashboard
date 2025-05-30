<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import * as Select from '$lib/components/ui/select';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils';
	import DisplayResult from '$lib/components/DisplayResult.svelte';

	const { data } = $props();
	const { dashboard, user } = $derived(data);
	const isOwner = $derived(user?.id === dashboard.userId);

	let currentVisibility = $state(dashboard.visibility || 'private');
	$effect(() => {
		if (dashboard.visibility) {
			currentVisibility = dashboard.visibility;
		}
	});

	async function updateVisibility(newVisibility: 'private' | 'public') {
		if (!isOwner) return;

		try {
			const response = await fetch(`/api/dashboards/${dashboard.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ visibility: newVisibility })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to update visibility');
			}

			const result = await response.json();
			currentVisibility = result.dashboard.visibility;
			toast.success('Dashboard visibility updated successfully!');
		} catch (error) {
			console.error('Error updating visibility:', error);
			toast.error(error instanceof Error ? error.message : 'An unknown error occurred');
		}
	}
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<header class="mb-6">
		<div class="mb-4 flex items-start justify-between gap-4">
			<div class="flex-1">
				<h1 class="text-3xl font-bold">{dashboard.name}</h1>
				<p class="text-muted-foreground text-sm">
					Created: {formatDate(dashboard.createdAt)}
				</p>
			</div>
			<div class="flex flex-col items-end gap-2">
				<Button variant="ghost" size="sm" href="/dashboards">Back to Dashboards</Button>
				{#if isOwner}
					<div class="w-[150px]">
						<Label
							for="visibility-select"
							class="text-muted-foreground mb-1 block text-xs font-medium"
						>
							Visibility
						</Label>
						<Select.Root
							type="single"
							value={currentVisibility}
							onValueChange={(value) => {
								if (value) {
									updateVisibility(value as 'private' | 'public');
								}
							}}
						>
							<Select.Trigger class="h-8 text-xs">
								{currentVisibility === 'public' ? 'Public' : 'Private'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="private" class="text-xs">Private</Select.Item>
								<Select.Item value="public" class="text-xs">Public</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				{:else}
					<div class="bg-muted text-muted-foreground mt-1 rounded-md border px-2 py-1 text-xs">
						{currentVisibility === 'public' ? 'Public' : 'Private'}
					</div>
				{/if}
			</div>
		</div>
	</header>

	<Separator class="my-6" />

	{#if dashboard.items && dashboard.items.length > 0}
		<div class="space-y-8">
			{#each dashboard.items as item (item.id)}
				{@const latestExecution = item.latestExecution}
				{@const itemLayout =
					typeof item.layout === 'string' ? JSON.parse(item.layout) : item.layout}

				<Card.Root>
					<Card.Header>
						<Card.Title>Item {item.id}</Card.Title>
						{#if item.sql}
							<Card.Description class="font-mono text-xs">{item.sql}</Card.Description>
						{/if}
					</Card.Header>
					<Card.Content>
						{#if latestExecution}
							<DisplayResult
								displayConfigs={[{ ...itemLayout, results: latestExecution.results.data }]}
							/>
							<p class="text-muted-foreground mt-2 text-xs">
								Executed: {formatDate(latestExecution.createdAt)}
							</p>
						{:else}
							<p class="text-muted-foreground text-sm">This item has not been executed yet.</p>
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{:else}
		<p class="text-muted-foreground text-center">This dashboard currently has no items.</p>
	{/if}
</div>
