<script lang="ts">
	let {
		data = [],
		stats = []
	}: {
		data: Record<string, any>[];
		stats: Array<{
			id: string; // column identifier
			name: string; // display name for the stat
			unit?: string; // optional unit (%, $, etc)
		}>;
	} = $props();

	// Use the first row of data for display
	let displayData = $derived.by(() => {
		return data.length > 0 ? data[0] : {};
	});

	// Create formatted stats from data
	let formattedStats = $derived.by(() => {
		if (data.length === 0 || stats.length === 0) return [];

		return stats.map((stat) => {
			return {
				value: displayData[stat.id] !== undefined ? displayData[stat.id] : 'N/A',
				name: stat.name,
				unit: stat.unit || ''
			};
		});
	});
</script>

<div class="my-4 w-full rounded-lg bg-gray-50 p-4">
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
		{#if formattedStats.length === 0}
			<div
				class="col-span-full rounded-md border border-dashed border-gray-300 p-8 text-center text-gray-600"
			>
				No statistics available
			</div>
		{:else}
			{#each formattedStats as stat}
				<div class="rounded-lg bg-white p-4 text-center shadow-sm">
					<div class="mb-1 text-3xl font-semibold text-blue-600">
						{stat.value}{stat.unit}
					</div>
					<div class="text-sm text-gray-600">{stat.name}</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
