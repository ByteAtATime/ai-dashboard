<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import DataTable from '$lib/components/DataTable.svelte';
	import ChartDisplay from '$lib/components/ChartDisplay.svelte';
	import type {
		TableDisplay,
		StatDisplay,
		ChartDisplay as ChartDisplayType
	} from '$lib/server/types/display.types';

	// Get the dashboard from the page data
	const { dashboard } = $page.data;

	// Parse the display data from JSON if it's stored as a string
	let displayData = $derived(
		typeof dashboard.displayData === 'string'
			? JSON.parse(dashboard.displayData)
			: dashboard.displayData
	);
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<header class="mb-6">
		<div class="mb-2 flex items-center justify-between">
			<h1 class="text-3xl font-bold">{dashboard.name}</h1>
			<Button variant="ghost" onclick={() => goto('/dashboards')}>Back to Dashboards</Button>
		</div>
		<p class="text-muted-foreground">
			Created: {formatDate(dashboard.createdAt)}
		</p>
		<p class="text-muted-foreground mt-2">
			Query: {dashboard.query}
		</p>
	</header>

	<Separator class="my-6" />

	{#if dashboard.explanation}
		<Card.Root class="mb-6">
			<Card.Header>
				<Card.Title>Explanation</Card.Title>
			</Card.Header>
			<Card.Content>
				<p>{dashboard.explanation}</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<div class="grid gap-6">
		{#each displayData as display, i}
			<Card.Root>
				{#if display.type === 'table'}
					<Card.Header>
						<Card.Title>{display.description || `Table ${i + 1}`}</Card.Title>
					</Card.Header>
					<Card.Content>
						<DataTable data={display.results || []} columns={display.columns || {}} />
					</Card.Content>
				{:else if display.type === 'stat'}
					<Card.Header>
						<Card.Title>{display.name || `Stat ${i + 1}`}</Card.Title>
						{#if display.description}
							<Card.Description>{display.description}</Card.Description>
						{/if}
					</Card.Header>
					<Card.Content>
						<div class="flex items-baseline">
							<span class="text-3xl font-bold">
								{display.results?.[0]?.[display.id] ?? 'N/A'}
							</span>
							{#if display.unit}
								<span class="text-muted-foreground ml-1 text-xl">{display.unit}</span>
							{/if}
						</div>
					</Card.Content>
				{:else if display.type === 'chart'}
					<Card.Content class="p-0">
						<ChartDisplay
							display={display as ChartDisplayType & { results: Record<string, unknown>[] }}
						/>
					</Card.Content>
				{:else}
					<Card.Header>
						<Card.Title>{display.title || `Display ${i + 1}`}</Card.Title>
						{#if display.description}
							<Card.Description>{display.description}</Card.Description>
						{/if}
					</Card.Header>
					<Card.Content>
						<DataTable data={display.results || []} columns={display.columns || {}} />
					</Card.Content>
				{/if}
			</Card.Root>
		{/each}
	</div>
</div>
