<script lang="ts">
	import type { DisplayConfig } from '$lib/server/types/display.types';

	import { Alert } from '$lib/components/ui/alert';
	import { onMount } from 'svelte';
	import QueryForm from '$lib/components/QueryForm.svelte';
	import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
	import SqlDisplay from '$lib/components/SqlDisplay.svelte';
	import DisplayResult from '$lib/components/DisplayResult.svelte';

	type DataSource = {
		id: string;
		name: string;
		connectionString: string;
		isDefault: boolean;
	};

	let dataSources = $state<DataSource[]>([]);
	let selectedDataSourceId = $state('');
	let dataSourcesLoading = $state(false);
	let dataSourcesError = $state('');

	let isLoading = $state(false);
	let error = $state('');
	let displayConfigs = $state<(DisplayConfig & { results: any[] })[]>([]);
	let progressMessages = $state<string[]>([]);
	let sqls = $state<string[]>([]);
	let showSql = $state(false);
	let currentStep = $state('');

	onMount(async () => {
		try {
			dataSourcesLoading = true;
			const response = await fetch('/api/datasources');
			if (!response.ok) throw new Error('Failed to fetch data sources');

			dataSources = await response.json();

			if (dataSources.length > 0) {
				const defaultSource = dataSources.find((ds) => ds.isDefault) || dataSources[0];
				selectedDataSourceId = defaultSource.id;
			}
		} catch (err) {
			dataSourcesError = err instanceof Error ? err.message : 'Failed to load data sources';
			console.error('Error loading data sources:', err);
		} finally {
			dataSourcesLoading = false;
		}
	});

	function resetQuery() {
		displayConfigs = [];
		sqls = [];
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

	<QueryForm
		bind:isLoading
		bind:error
		bind:displayConfigs
		bind:progressMessages
		bind:sqls
		bind:currentStep
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

	{#if sqls.length > 0 && showSql}
		<SqlDisplay {sqls} />
	{/if}

	{#if displayConfigs.length > 0}
		<DisplayResult {displayConfigs} />
	{/if}
</div>
