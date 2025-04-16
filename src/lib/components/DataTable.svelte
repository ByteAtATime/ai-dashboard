<script lang="ts">
	let {
		data = [],
		columns = {}
	}: {
		data: Record<string, any>[];
		columns?: Record<string, string>; // mapping of column names to display titles
	} = $props();

	// Derive the columns from the data if not provided
	let displayColumns = $derived.by(() => {
		// If columns mapping is provided, use those
		if (Object.keys(columns).length > 0) {
			return Object.keys(columns);
		}

		// Otherwise, detect columns from data
		if (data.length === 0) return [];
		const allKeys = new Set<string>();
		data.forEach((row) => {
			Object.keys(row).forEach((key) => allKeys.add(key));
		});
		return Array.from(allKeys);
	});

	// Function to get display title for a column
	function getColumnTitle(colKey: string): string {
		if (columns && columns[colKey]) {
			return columns[colKey];
		}
		// If no mapping provided, use the column key with basic formatting
		return colKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}
</script>

<div class="my-4 w-full">
	{#if data.length === 0}
		<div class="rounded-md border border-dashed border-gray-300 p-8 text-center text-gray-600">
			No data available
		</div>
	{:else}
		<div class="max-w-full overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr>
						{#each displayColumns as column}
							<th class="border-b border-gray-300 bg-gray-100 p-2 text-left font-semibold">
								{getColumnTitle(column)}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each data as row}
						<tr class="hover:bg-gray-50">
							{#each displayColumns as column}
								<td class="border-b border-gray-200 p-2">
									{row[column] !== undefined ? row[column] : ''}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
