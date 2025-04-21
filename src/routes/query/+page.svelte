<script lang="ts">
	import type { DisplayConfig } from '$lib/server/types/display.types';

	import { Alert } from '$lib/components/ui/alert';
	import { onMount } from 'svelte';
	import QueryForm from '$lib/components/QueryForm.svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import DisplayResult from '$lib/components/DisplayResult.svelte';

	const { data } = $props();
	const { mockData } = $derived(data);

	type DataSource = {
		id: string;
		name: string;
		connectionString: string;
		isDefault: boolean;
	};

	let dataSources = $state<DataSource[]>([]);
	let selectedDataSourceId = $state('');

	let isLoading = $state(false);
	let error = $state('');
	let displayConfigs = $state<(DisplayConfig & { results: Record<string, unknown>[] })[]>([]);
	let progressMessages = $state<string[]>([]);
	let showSql = $state(false);
	let currentStep = $state('');
	let query = $state('');
	let isUsingMockData = $state(false);

	onMount(async () => {
		if (mockData) {
			console.log('Using mock data from environment variable');
			isUsingMockData = true;
			displayConfigs = mockData.display || [];
			query = mockData.query || '';
			selectedDataSourceId = mockData.dataSourceId || '';
			isLoading = false;
			return; // Don't fetch datasources if using mock data
		}

		// Fetch real datasources if not using mock data
		try {
			const response = await fetch('/api/datasources');
			if (!response.ok) throw new Error('Failed to fetch data sources');

			dataSources = await response.json();

			if (dataSources.length > 0) {
				const defaultSource = dataSources.find((ds) => ds.isDefault) || dataSources[0];
				selectedDataSourceId = defaultSource.id;
			}
		} catch (err) {
			console.error('Error loading data sources:', err);
		}
	});

	function resetQuery() {
		displayConfigs = [];
		error = '';
		progressMessages = [];
		showSql = false;
		isLoading = false;
		currentStep = '';
	}

	function toggleSql() {
		showSql = !showSql;
	}
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<header class="mb-6">
		<h1 class="text-3xl font-bold">Data Explorer</h1>
		<p class="text-muted-foreground mt-2 text-lg">
			Ask questions about your data in plain English and get instant visualizations
		</p>
	</header>

	{#if isUsingMockData}
		<Alert variant="default" class="mb-6">
			<span class="font-semibold">Using Mock Data:</span> Displaying results from the
			<code>MOCK_QUERY_RESULT</code> environment variable.
		</Alert>
	{/if}

	<QueryForm
		bind:isLoading
		bind:error
		bind:displayConfigs
		bind:progressMessages
		bind:currentStep
		bind:query
		bind:selectedDataSourceId
		{resetQuery}
		{toggleSql}
		{showSql}
	/>

	{#if error}
		<Alert variant="destructive" class="mb-6">
			<span>{error}</span>
		</Alert>
	{/if}

	{#if isLoading}
		<LoadingIndicator {currentStep} {progressMessages} />
	{/if}

	{#if displayConfigs.length > 0}
		<DisplayResult {displayConfigs} />
	{/if}
</div>
