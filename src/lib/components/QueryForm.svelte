<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Alert } from '$lib/components/ui/alert';
	import SaveDashboard from '$lib/components/SaveDashboard.svelte';
	import type { DisplayConfig, QueryContext } from '$lib/server/types/display.types';

	type DataSource = {
		id: string;
		name: string;
		connectionString: string;
		isDefault: boolean;
	};

	type Props = {
		isLoading: boolean;
		error: string;
		displayConfigs: (DisplayConfig & { results: any[] })[];
		progressMessages: string[];
		sqls: string[];
		currentStep: string;
		showFollowup: boolean;
		previousContext: QueryContext | null;
		toggleSql: () => void;
		resetQuery: () => void;
		showSql: boolean;
	};

	let {
		isLoading = $bindable(),
		error = $bindable(),
		displayConfigs = $bindable(),
		progressMessages = $bindable(),
		sqls = $bindable(),
		currentStep = $bindable(),
		showFollowup = $bindable(),
		previousContext = $bindable(),
		toggleSql,
		resetQuery,
		showSql
	}: Props = $props();

	// Internal state for the form
	let dataSources = $state<DataSource[]>([]);
	let selectedDataSourceId = $state('');
	let dataSourcesLoading = $state(false);
	let dataSourcesError = $state('');
	let query = $state('');
	let followupInstruction = $state('');
	let originalQuery = $state(''); // Used to display original query in follow-up mode

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

	async function submitQuery() {
		if (!query.trim()) {
			error = 'Please enter a query';
			return;
		}

		if (!selectedDataSourceId && dataSources.length > 0) {
			error = 'Please select a data source';
			return;
		}

		isLoading = true;
		error = '';
		progressMessages = [];
		displayConfigs = [];
		sqls = [];
		currentStep = 'Starting...';
		followupInstruction = '';
		showFollowup = false;
		previousContext = null;
		originalQuery = '';

		try {
			const response = await fetch('/api/query/stream', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					query,
					dataSourceId: selectedDataSourceId
				})
			});

			if (!response.ok) {
				throw new Error(`Server error: ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Stream reader not available');
			}

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					break;
				}

				buffer += decoder.decode(value, { stream: true });

				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.trim()) continue;

					try {
						const data = JSON.parse(line);

						if (data.type === 'progress') {
							progressMessages = [...progressMessages, data.message];
							currentStep = data.message;
						} else if (data.type === 'result') {
							displayConfigs = data.data.display || [];

							sqls = displayConfigs.map((config) => config.sql);
							currentStep = 'Complete';

							previousContext = {
								query: query,
								display: displayConfigs,
								explanation: data.data.explanation,
								dataSourceId: selectedDataSourceId
							};

							showFollowup = true;
						} else if (data.type === 'error') {
							error = data.error || 'An unexpected error occurred';
						}
					} catch (e) {
						console.error('Error parsing streaming response:', e, line);
					}
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred';
			console.error('Query error:', err);
		} finally {
			isLoading = false;
		}
	}

	async function submitFollowup() {
		if (!followupInstruction.trim() || !previousContext) {
			error = 'Please enter a follow-up instruction';
			return;
		}

		isLoading = true;
		error = '';
		progressMessages = [];
		sqls = [];
		currentStep = 'Processing follow-up...';
		originalQuery = previousContext.query; // Store the query that led to this follow-up

		try {
			const response = await fetch('/api/query/followup/stream', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					followupInstruction,
					previousContext,
					dataSourceId: previousContext.dataSourceId || selectedDataSourceId
				})
			});

			if (!response.ok) {
				throw new Error(`Server error: ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('Stream reader not available');
			}

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					break;
				}

				buffer += decoder.decode(value, { stream: true });

				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.trim()) continue;

					try {
						const data = JSON.parse(line);

						if (data.type === 'progress') {
							progressMessages = [...progressMessages, data.message];
							currentStep = data.message;
						} else if (data.type === 'result') {
							displayConfigs = data.data.display || [];
							sqls = displayConfigs.map((config) => config.sql);
							currentStep = 'Complete';

							previousContext = {
								// Update context with the follow-up instruction as the new query
								query: followupInstruction,
								display: displayConfigs,
								explanation: data.data.explanation,
								dataSourceId: previousContext.dataSourceId || selectedDataSourceId
							};

							followupInstruction = ''; // Clear input after successful follow-up
						} else if (data.type === 'error') {
							error = data.error || 'An unexpected error occurred';
						}
					} catch (e) {
						console.error('Error parsing streaming response:', e, line);
					}
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred';
			console.error('Follow-up query error:', err);
		} finally {
			isLoading = false;
		}
	}

	function handleReset() {
		query = '';
		followupInstruction = '';
		originalQuery = '';
		resetQuery(); // Call the parent's reset function
	}
</script>

<div class="mb-8 border-b pb-6">
	{#if !showFollowup || !displayConfigs.length}
		<!-- Initial Query Form -->
		<form
			onsubmit={(e) => {
				e.preventDefault();
				submitQuery();
			}}
			class="space-y-4"
		>
			<!-- Data Source Selector -->
			{#if dataSourcesLoading}
				<div class="text-muted-foreground text-sm">Loading data sources...</div>
			{:else if dataSourcesError}
				<Alert variant="destructive" class="mb-2">
					<span>Error loading data sources: {dataSourcesError}</span>
				</Alert>
			{:else if dataSources.length === 0}
				<Alert variant="destructive" class="mb-2">
					<span
						>No data sources available. <a href="/datasources" class="underline"
							>Add a data source</a
						>
						to continue.</span
					>
				</Alert>
			{:else}
				<div class="grid gap-2">
					<label for="dataSource" class="text-sm font-medium">Data Source</label>
					<select
						id="dataSource"
						bind:value={selectedDataSourceId}
						class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#each dataSources as ds}
							<option value={ds.id}>{ds.name}{ds.isDefault ? ' (Default)' : ''}</option>
						{/each}
					</select>
				</div>
			{/if}

			<Textarea
				bind:value={query}
				placeholder="Ask a question about your data (e.g., 'Show me the top 5 customers by revenue and their total order count')"
				rows={3}
				class="w-full"
			/>
			<div class="flex flex-wrap gap-3">
				<Button type="submit" disabled={isLoading || dataSources.length === 0}>
					{isLoading ? 'Processing...' : 'Run Query'}
				</Button>
				<Button type="button" onclick={handleReset} variant="outline">Reset</Button>
				{#if displayConfigs.length > 0}
					<Button type="button" onclick={toggleSql} variant="outline">
						{showSql ? 'Hide SQL' : 'Show SQL'}
					</Button>
					<SaveDashboard
						{query}
						display={displayConfigs}
						explanation={previousContext?.explanation || ''}
					/>
				{/if}

				<a
					href="/datasources"
					class="ml-auto flex items-center text-sm text-blue-600 hover:underline"
				>
					Manage Data Sources
				</a>
			</div>
		</form>
	{:else}
		<!-- Follow-up Query Form -->
		<div class="space-y-3">
			{#if dataSources.length > 0 && selectedDataSourceId}
				<div class="text-muted-foreground mb-2 text-sm">
					<span class="font-medium">Data Source:</span>
					{dataSources.find(
						(ds) => ds.id === (previousContext?.dataSourceId || selectedDataSourceId)
					)?.name || 'Unknown'}
				</div>
			{/if}

			{#if originalQuery}
				<div class="text-muted-foreground text-sm">
					<span class="font-medium">Original query:</span>
					{originalQuery}
				</div>
			{/if}
			<div class="text-muted-foreground mb-2 text-sm">
				<span class="font-medium">Current query:</span>
				{previousContext?.query || query}
			</div>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					submitFollowup();
				}}
				class="space-y-4"
			>
				<Textarea
					bind:value={followupInstruction}
					placeholder="Ask a follow-up question (e.g., 'Add a column showing total hours spent' or 'Filter to only show data from last month')"
					rows={2}
					class="w-full"
				/>
				<div class="flex flex-wrap gap-3">
					<Button type="submit" disabled={isLoading}>
						{isLoading ? 'Processing...' : 'Run Follow-up'}
					</Button>
					<Button type="button" onclick={handleReset} variant="outline" disabled={isLoading}>
						New Query
					</Button>
					{#if sqls.length > 0}
						<Button type="button" onclick={toggleSql} variant="secondary" class="ml-auto">
							{showSql ? 'Hide SQL' : 'Show SQL'}
						</Button>
						<SaveDashboard
							query={previousContext?.query || query}
							display={displayConfigs}
							explanation={previousContext?.explanation || ''}
						></SaveDashboard>
					{/if}
				</div>
			</form>
		</div>
	{/if}
</div>
