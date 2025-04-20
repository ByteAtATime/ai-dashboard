<script lang="ts">
	let {
		data = [],
		id,
		name,
		format
	}: {
		data: Record<string, any>[];
		id: string;
		name: string;
		format?: string;
	} = $props();

	let displayData = $derived.by(() => {
		return data.length > 0 ? data[0] : {};
	});

	function formatValue(value: any, format?: string): string {
		if (value === undefined) return 'N/A';
		if (!format) return String(value);

		return format.replace('{0}', value);
	}

	const formattedStat = $derived(
		data.length > 0
			? {
					formattedValue: formatValue(displayData[id], format),
					name: name
				}
			: null
	);
</script>

{#if !formattedStat}
	<div
		class="col-span-full rounded-md border border-dashed border-gray-300 p-8 text-center text-gray-600"
	>
		No statistics available
	</div>
{:else}
	<div class="rounded-lg bg-white p-4 text-center shadow-sm">
		<div class="mb-1 text-3xl font-semibold text-blue-600">
			{formattedStat.formattedValue}
		</div>
		<div class="text-sm text-gray-600">{formattedStat.name}</div>
	</div>
{/if}
