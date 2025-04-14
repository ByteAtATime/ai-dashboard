<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';

	let tables = $state<
		Array<{
			name: string;
			rowCount: number | null;
			columns: Array<{
				name: string;
				type: string;
				nullable: boolean;
			}>;
		}>
	>([]);
	let isLoading = $state(false);
	let error = $state('');
	let selectedTable = $state('');
	let sampleRows = $state<Record<string, any>[]>([]);
	let sampleLimit = $state(5);

	$effect.pre(() => {
		fetchTables();
	});

	$effect(() => {
		if (selectedTable) {
			fetchSamples(selectedTable, sampleLimit);
		}
	});

	async function fetchTables() {
		isLoading = true;
		error = '';

		try {
			const response = await fetch('/api/tables');
			if (!response.ok) {
				throw new Error('Failed to fetch tables');
			}

			tables = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred';
			console.error('Error fetching tables:', err);
		} finally {
			isLoading = false;
		}
	}

	async function fetchSamples(table: string, limit: number) {
		if (!table) return;

		isLoading = true;
		error = '';

		try {
			const response = await fetch(`/api/sample/${table}?limit=${limit}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch samples for ${table}`);
			}

			sampleRows = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred';
			console.error('Error fetching samples:', err);
			sampleRows = [];
		} finally {
			isLoading = false;
		}
	}

	function refreshSamples() {
		if (selectedTable) {
			fetchSamples(selectedTable, sampleLimit);
		}
	}
</script>

<div class="mx-auto max-w-6xl px-4 py-8">
	<h1 class="mb-1 text-3xl font-bold">Database Explorer</h1>
	<p class="mb-8 text-gray-600">Browse tables and view random samples of your data.</p>

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

	<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
		<div class="md:col-span-1">
			<div class="mb-4 rounded-lg bg-gray-100 p-4">
				<h2 class="mb-4 text-xl font-semibold">Tables</h2>

				{#if isLoading && tables.length === 0}
					<div class="py-4 text-center text-gray-500">Loading tables...</div>
				{:else if tables.length === 0}
					<div class="py-4 text-center text-gray-500">No tables found</div>
				{:else}
					<ul class="space-y-1">
						{#each tables as table}
							<li>
								<button
									onclick={() => (selectedTable = table.name)}
									class="w-full rounded px-3 py-2 text-left hover:bg-gray-200 {selectedTable ===
									table.name
										? 'bg-blue-100 font-medium text-blue-800'
										: ''}"
								>
									<div class="flex items-center justify-between">
										<span>{table.name}</span>
										{#if table.rowCount !== null}
											<span class="text-xs text-gray-500">{table.rowCount} rows</span>
										{/if}
									</div>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<div class="md:col-span-2">
			{#if selectedTable}
				<div class="rounded-lg bg-white p-4 shadow-sm">
					<div class="mb-4 flex items-center justify-between">
						<h2 class="text-xl font-semibold">{selectedTable}</h2>
						<div class="flex items-center gap-3">
							<div class="flex items-center gap-2">
								<label for="sampleLimit" class="text-sm text-gray-600">Rows:</label>
								<select
									id="sampleLimit"
									bind:value={sampleLimit}
									class="rounded border border-gray-300 px-2 py-1 text-sm"
								>
									{#each [1, 3, 5, 10] as limit}
										<option value={limit}>{limit}</option>
									{/each}
								</select>
							</div>
							<button
								onclick={refreshSamples}
								class="flex items-center gap-1 rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M23 4v6h-6"></path>
									<path d="M1 20v-6h6"></path>
									<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
									<path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
								</svg>
								Refresh
							</button>
						</div>
					</div>

					<div class="mb-4">
						<h3 class="mb-2 text-sm font-medium text-gray-500">Schema</h3>
						<div class="max-h-36 overflow-y-auto rounded border border-gray-200">
							<table class="w-full border-collapse text-sm">
								<thead>
									<tr class="bg-gray-50">
										<th class="border-b px-3 py-2 text-left">Column</th>
										<th class="border-b px-3 py-2 text-left">Type</th>
										<th class="border-b px-3 py-2 text-left">Nullable</th>
									</tr>
								</thead>
								<tbody>
									{#each tables.find((t) => t.name === selectedTable)?.columns || [] as column}
										<tr class="border-b border-gray-100 last:border-0">
											<td class="px-3 py-2 font-medium">{column.name}</td>
											<td class="px-3 py-2 text-gray-600">{column.type}</td>
											<td class="px-3 py-2">
												{#if column.nullable}
													<span class="text-gray-500">Yes</span>
												{:else}
													<span class="font-medium text-gray-800">No</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div>
						<h3 class="mb-2 text-sm font-medium text-gray-500">
							Random Sample {isLoading ? '(Loading...)' : ''}
						</h3>
						{#if sampleRows.length === 0 && !isLoading}
							<div
								class="rounded-md border border-dashed border-gray-300 p-8 text-center text-gray-600"
							>
								No data available in this table
							</div>
						{:else}
							<DataTable data={sampleRows} />
						{/if}
					</div>
				</div>
			{:else}
				<div
					class="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500"
				>
					Select a table to view sample data
				</div>
			{/if}
		</div>
	</div>
</div>
