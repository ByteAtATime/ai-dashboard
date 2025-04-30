<script lang="ts">
	import type {
		ChartDisplay as ChartDisplayType,
		DisplayConfig,
		StatDisplay,
		TableDisplay
	} from '$lib/server/types/display.types';
	import DataTable from './DataTable.svelte';
	import ChartDisplay from './ChartDisplay.svelte';
	import StatsCard from './StatCard.svelte';
	import * as Card from './ui/card';
	import { Separator } from './ui/separator';

	type Props = {
		displayConfigs: (DisplayConfig & { results: Record<string, unknown>[] })[];
	};

	let { displayConfigs }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
	{#each displayConfigs as config, i}
		{#if config.type === 'table'}
			{@const tableConfig = config as TableDisplay & { results: Record<string, unknown>[] }}
			<Card.Root class="overflow-hidden lg:col-span-12">
				{#if tableConfig.description}
					<Card.Header class="py-3">
						<Card.Title class="text-base">{tableConfig.description}</Card.Title>
					</Card.Header>
					<Separator />
				{/if}
				<div class="overflow-x-auto">
					<DataTable data={tableConfig.results || []} columns={tableConfig.columns || {}} />
				</div>
			</Card.Root>
		{:else if config.type === 'stat'}
			{@const statConfig = config as StatDisplay & { results: Record<string, unknown>[] }}
			<!-- Passing individual props expected by StatsCard -->
			<StatsCard
				data={statConfig.results}
				id={statConfig.id}
				name={statConfig.name}
				format={statConfig.format}
			/>
		{:else if config.type === 'chart'}
			<Card.Root class="lg:col-span-12">
				<Card.Content class="p-0">
					<ChartDisplay
						display={config as ChartDisplayType & { results: Record<string, unknown>[] }}
					/>
				</Card.Content>
			</Card.Root>
		{:else}
			{@const unknownConfig = config as {
				type: string;
				description?: string;
				results?: Record<string, unknown>[];
			}}
			<!-- Fallback for unknown types -->
			<Card.Root class="lg:col-span-12">
				<Card.Header>
					<Card.Title>{unknownConfig.description || `Display ${i + 1}`}</Card.Title>
				</Card.Header>
				<Card.Content>
					<p>Unsupported display type: {unknownConfig.type}</p>
					{#if unknownConfig.results}
						<pre>{JSON.stringify(unknownConfig.results, null, 2)}</pre>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
	{/each}
</div>
