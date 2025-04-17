<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import DataTable from '$lib/components/DataTable.svelte';

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
				<Card.Header>
					<Card.Title>{display.title || `Chart ${i + 1}`}</Card.Title>
					{#if display.description}
						<Card.Description>{display.description}</Card.Description>
					{/if}
				</Card.Header>
				<Card.Content>
					<DataTable data={display.results || []} columns={display.columns || {}} />
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
