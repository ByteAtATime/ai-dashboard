<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import StatsCard from '$lib/components/StatsCard.svelte';
	import type { TableDisplay, StatsDisplay, DisplayConfig } from '$lib/server/openrouter';

	let query = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let results = $state<Record<string, any>[]>([]);
	let sqlQuery = $state('');
	let displayConfig = $state<DisplayConfig | null>(null);

	async function submitQuery() {
		if (!query.trim()) {
			error = 'Please enter a query';
			return;
		}

		isLoading = true;
		error = '';

		try {
			const response = await fetch('/api/query', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ query })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to process query');
			}

			const data = await response.json();

			results = data.results || [];
			sqlQuery = data.sql || '';
			displayConfig = data.display || {
				type: 'table',
				columns: {}
			};
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred';
			console.error('Query error:', err);
		} finally {
			isLoading = false;
		}
	}

	function resetQuery() {
		query = '';
		results = [];
		sqlQuery = '';
		error = '';
		displayConfig = null;
	}
</script>

<div class="mx-auto max-w-6xl px-4 py-8">
	<h1 class="mb-1 text-3xl font-bold">AI SQL Query</h1>
	<p class="mb-8 text-gray-600">
		Ask questions about your data in plain English and get instant results.
	</p>

	<div class="mb-8 rounded-lg bg-gray-100 p-6">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				submitQuery();
			}}
		>
			<div class="mb-4">
				<textarea
					bind:value={query}
					placeholder="Ask a question about your data (e.g., 'Show me the top 5 customers by revenue')"
					rows="3"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:ring-2 focus:ring-blue-500 focus:outline-none"
				></textarea>
			</div>
			<div class="flex gap-2">
				<button
					type="submit"
					class="rounded-md bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
					disabled={isLoading}
				>
					{isLoading ? 'Processing...' : 'Run Query'}
				</button>
				<button
					type="button"
					onclick={resetQuery}
					class="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
					disabled={isLoading || !query}
				>
					Clear
				</button>
			</div>
		</form>
	</div>

	{#if error}
		<div class="mb-6 flex items-center gap-2 rounded-md bg-red-100 p-3 text-red-800">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="flex-shrink-0"
			>
				<circle cx="12" cy="12" r="10"></circle>
				<line x1="12" y1="8" x2="12" y2="12"></line>
				<line x1="12" y1="16" x2="12.01" y2="16"></line>
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	{#if sqlQuery}
		<div class="mb-8 overflow-x-auto rounded-md bg-slate-800 p-4">
			<h3 class="mb-2 text-sm text-slate-400">Generated SQL</h3>
			<pre class="font-mono whitespace-pre-wrap text-slate-200">{sqlQuery}</pre>
		</div>
	{/if}

	{#if results.length > 0 && displayConfig}
		<div class="mt-8">
			{#if displayConfig.type === 'table'}
				<DataTable data={results} columns={(displayConfig as TableDisplay).columns} />
			{:else if displayConfig.type === 'stats'}
				<StatsCard data={results} stats={(displayConfig as StatsDisplay).stats} />
			{:else if displayConfig.type === 'barchart' || displayConfig.type === 'linechart'}
				<div
					class="mb-6 rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center"
				>
					<p class="mb-4 text-gray-700">
						Chart visualization would appear here ({displayConfig.type})
					</p>
					<!-- In a real implementation, we would use a charting library like Chart.js or D3 -->
					<DataTable data={results} />
				</div>
			{/if}
		</div>
	{/if}
</div>
