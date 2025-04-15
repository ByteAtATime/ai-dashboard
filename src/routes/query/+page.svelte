<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import type { TableDisplay, StatDisplay, DisplayConfig } from '$lib/server/openrouter';

	let query = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let displayConfigs = $state<(DisplayConfig & { results: any[] })[]>([]); // Supports multiple display configs with results
	let progressMessages = $state<string[]>([]);
	let showProgress = $state(false);
	let sqls = $state<string[]>([]);
	let showSql = $state(false);
	let currentStep = $state('');

	async function submitQuery() {
		if (!query.trim()) {
			error = 'Please enter a query';
			return;
		}

		isLoading = true;
		error = '';
		progressMessages = [];
		showProgress = true;
		displayConfigs = [];
		sqls = [];
		currentStep = 'Starting...';

		try {
			const response = await fetch('/api/query/stream', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ query })
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
							// Extract SQLs for display
							sqls = displayConfigs.map(config => config.sql);
							currentStep = 'Complete';
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

	function resetQuery() {
		query = '';
		displayConfigs = [];
		sqls = [];
		error = '';
		progressMessages = [];
		showProgress = false;
	}
	
	function toggleSql() {
		showSql = !showSql;
	}
</script>

<div class="mx-auto max-w-6xl px-4 py-8">
	<header class="mb-8">
		<h1 class="text-3xl font-bold text-gray-800">Data Explorer</h1>
		<p class="mt-2 text-lg text-gray-600">
			Ask questions about your data in plain English and get instant visualizations
		</p>
	</header>

	<div class="mb-8 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				submitQuery();
			}}
			class="space-y-4"
		>
			<div>
				<textarea
					bind:value={query}
					placeholder="Ask a question about your data (e.g., 'Show me the top 5 customers by revenue and their total order count')"
					rows="3"
					class="w-full rounded-lg border border-gray-300 px-4 py-3 text-base font-normal shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all"
				></textarea>
			</div>
			<div class="flex flex-wrap gap-3">
				<button
					type="submit"
					class="rounded-full bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 focus:outline-none transition-all disabled:bg-blue-400 disabled:cursor-not-allowed"
					disabled={isLoading}
				>
					{isLoading ? 'Processing...' : 'Run Query'}
				</button>
				<button
					type="button"
					onclick={resetQuery}
					class="rounded-full bg-gray-100 px-6 py-2.5 font-medium text-gray-700 hover:bg-gray-200 focus:ring-4 focus:ring-gray-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={isLoading || !query}
				>
					Clear
				</button>
				{#if sqls.length > 0}
					<button
						type="button"
						onclick={toggleSql}
						class="ml-auto rounded-full bg-gray-800 px-6 py-2.5 font-medium text-white hover:bg-gray-700 focus:ring-4 focus:ring-gray-500/20 focus:outline-none transition-all"
					>
						{showSql ? 'Hide SQL' : 'Show SQL'}
					</button>
				{/if}
			</div>
		</form>
	</div>

	{#if error}
		<div class="mb-6 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-700 border border-red-100">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
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
			<span class="font-medium">{error}</span>
		</div>
	{/if}

	{#if isLoading}
		<div class="mb-8 rounded-lg border border-blue-100 bg-blue-50 p-5">
			<div class="flex items-center gap-3 mb-4">
				<div class="h-5 w-5 animate-spin rounded-full border-3 border-blue-500 border-t-transparent"></div>
				<span class="font-medium text-blue-700">{currentStep}</span>
			</div>
			
			<div class="relative">
				<div class="absolute left-2.5 top-0 bottom-0 w-0.5 bg-blue-200 rounded-full"></div>
				<ul class="space-y-3 pl-8">
					{#each progressMessages as message, i}
						<li class="relative flex items-center text-blue-700 text-sm">
							<div class="absolute left-[-23px] h-5 w-5 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center">
								<div class="h-2 w-2 rounded-full bg-blue-500"></div>
							</div>
							<span>{message}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}

	{#if sqls.length > 0 && showSql}
		<div class="mb-8 overflow-hidden rounded-lg bg-gray-900 shadow-lg">
			<div class="flex items-center justify-between px-4 py-3 bg-gray-800">
				<h3 class="font-medium text-gray-200">Generated SQL</h3>
				{#if sqls.length > 1}
					<span class="px-2.5 py-1 rounded-full bg-gray-700 text-xs text-gray-300">{sqls.length} Queries</span>
				{/if}
			</div>
			<div class="p-4 overflow-x-auto">
				{#each sqls as sql, index}
					<div class="mb-4 last:mb-0">
						{#if sqls.length > 1}
							<p class="mb-1.5 text-xs font-medium text-gray-400">Query {index + 1}:</p>
						{/if}
						<pre class="font-mono text-sm whitespace-pre-wrap text-gray-200 bg-gray-800/50 p-3 rounded-md overflow-x-auto">{sql}</pre>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if displayConfigs.length > 0}
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
			{#each displayConfigs as config, i}
				{#if config.type === 'table'}
					<div class="lg:col-span-12 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
						{#if (config as TableDisplay).description}
							<div class="p-4 border-b border-gray-100">
								<h3 class="font-medium text-gray-800">{(config as TableDisplay).description}</h3>
							</div>
						{/if}
						<div class="overflow-x-auto">
							<DataTable data={config.results} columns={(config as TableDisplay).columns} />
						</div>
					</div>
				{:else if config.type === 'stat'}
					<div class="lg:col-span-4 sm:col-span-6 bg-white rounded-lg shadow-sm border border-gray-100 p-5 transition-all hover:shadow-md">
						<p class="text-sm font-medium text-gray-500 mb-1">{(config as StatDisplay).name}</p>
						<div class="flex items-baseline">
							<span class="text-3xl font-bold text-gray-800">
								{config.results[0]?.[config.id] ?? 'N/A'}
							</span>
							{#if (config as StatDisplay).unit}
								<span class="ml-1 text-xl text-gray-500">{(config as StatDisplay).unit}</span>
							{/if}
						</div>
						{#if (config as StatDisplay).description}
							<p class="mt-3 text-sm text-gray-600">{(config as StatDisplay).description}</p>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
		
		<!-- Results summary if available -->
		{#if displayConfigs.length > 0 && displayConfigs.some(c => c.type === 'table')}
			<div class="mt-4 text-sm text-gray-500">
				Showing {displayConfigs.filter(c => c.type === 'table')[0].results.length} results
			</div>
		{/if}
	{/if}
</div>
