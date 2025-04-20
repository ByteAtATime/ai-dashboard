<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';
	import DisplayResult from '$lib/components/DisplayResult.svelte';
	import type { DisplayConfig } from '$lib/server/types/display.types';

	const { dashboard } = $page.data;

	let displayData: (DisplayConfig & { results: any[] })[] = $state(
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

	<DisplayResult displayConfigs={displayData} />
</div>
