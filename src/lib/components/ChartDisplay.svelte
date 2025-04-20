<script lang="ts">
	import { Chart, Highlight, Svg, Axis, Bars, Points, Pie, Tooltip, Spline } from 'layerchart';
	import { sum } from 'd3-array';
	import { scaleBand } from 'd3-scale';

	import type { ChartDisplay } from '$lib/server/types/display.types';

	type Props = {
		display: ChartDisplay & { results: Record<string, unknown>[] };
	};

	let { display }: Props = $props();
	display.results = display.results.filter((x) => x.check_in_time != '0');

	let chartType = $derived(display.chartType);
	let data = $derived(display.results);
	let xKey = $derived(display.xAxis.column);
	let yKey = $derived(display.yAxis.column);

	function getColorByIndex(index: number, total: number): string {
		return `hsl(${(index * 360) / (total || 1)}, 70%, 50%)`;
	}

	let dataSum = $derived.by(() => {
		if (chartType !== 'pie' || !data.length) return 0;
		return sum(data, (d: Record<string, unknown>) => Number(d[yKey]) || 0);
	});

	function formatLabel(value: unknown): string {
		if (value instanceof Date) {
			return value.toLocaleDateString();
		}
		return String(value);
	}

	function formatPercent(value: number): string {
		return new Intl.NumberFormat(undefined, {
			style: 'percent',
			minimumFractionDigits: 1,
			maximumFractionDigits: 1
		}).format(value);
	}

	const chartProps = $derived({
		data,
		x: (d: Record<string, unknown>) => d[xKey],
		y: (d: Record<string, unknown>) => Number(d[yKey]),
		padding: { left: 32, bottom: 32 }
	});
</script>

<div class="rounded-lg bg-white p-4 shadow-sm">
	<h3 class="mb-2 text-lg font-medium">{display.title}</h3>

	{#if data.length}
		<div class="h-[300px] w-full">
			{#if chartType === 'bar'}
				<Chart
					{...chartProps}
					xScale={scaleBand().padding(0.2)}
					yNice
					tooltip={{ mode: 'band' }}
					let:tooltip
				>
					<Svg>
						<Axis placement="bottom" grid label={display.xAxis.label} />
						<Axis placement="left" grid label={display.yAxis.label} />

						<Bars rounded="top" radius={4} class="fill-primary" {tooltip} />
						<Highlight area />
					</Svg>
					<Tooltip.Root let:data>
						<Tooltip.Header>{formatLabel(data[xKey])}</Tooltip.Header>
						<Tooltip.List>
							<Tooltip.Item
								label={display.yAxis.label}
								value={Number(data[yKey])}
								valueAlign="right"
							/>
						</Tooltip.List>
					</Tooltip.Root>
				</Chart>
			{:else if chartType === 'line'}
				<Chart {...chartProps} tooltip={{ mode: 'bisect-x' }} yNice let:tooltip>
					<Svg>
						<Axis placement="bottom" label={display.xAxis.label} />
						<Axis placement="left" label={display.yAxis.label} />

						<Spline class="stroke-primary stroke-2" {tooltip} />
						<Highlight points lines />
					</Svg>
					<Tooltip.Root let:data>
						<Tooltip.Header>{formatLabel(data[xKey])}</Tooltip.Header>
						<Tooltip.List>
							<Tooltip.Item
								label={display.yAxis.label}
								value={Number(data[yKey])}
								valueAlign="right"
							/>
						</Tooltip.List>
					</Tooltip.Root>
				</Chart>
			{:else if chartType === 'scatter'}
				<Chart {...chartProps} tooltip={{ mode: 'voronoi' }} xNice yNice let:tooltip>
					<Svg>
						<Axis placement="bottom" label={display.xAxis.label} grid class="stroke-muted" />
						<Axis placement="left" label={display.yAxis.label} grid class="stroke-muted" />

						<Points
							{data}
							x={(d: Record<string, unknown>) => d[xKey]}
							y={(d: Record<string, unknown>) => Number(d[yKey])}
							fill="hsl(220, 70%, 50%)"
							size={6}
							{tooltip}
						/>
						<Highlight points lines axis="both" />
					</Svg>
					<Tooltip.Root let:data>
						<Tooltip.Header>{formatLabel(data[xKey])}</Tooltip.Header>
						<Tooltip.List>
							<Tooltip.Item
								label={display.xAxis.label}
								value={formatLabel(data[xKey])}
								valueAlign="right"
							/>
							<Tooltip.Item
								label={display.yAxis.label}
								value={Number(data[yKey])}
								valueAlign="right"
							/>
						</Tooltip.List>
					</Tooltip.Root>
				</Chart>
			{:else if chartType === 'pie'}
				<Chart
					{...chartProps}
					c={(d: Record<string, unknown>) => d[xKey]}
					x={(d: Record<string, unknown>) => Number(d[yKey])}
					cRange={Array.from({ length: data.length }, (_, i) => getColorByIndex(i, data.length))}
					let:tooltip
				>
					<Svg center>
						<Pie {tooltip} />
					</Svg>
					<Tooltip.Root let:data>
						<Tooltip.Header>{formatLabel(data[xKey])}</Tooltip.Header>
						<Tooltip.List>
							<Tooltip.Item
								label={display.yAxis.label}
								value={Number(data[yKey])}
								valueAlign="right"
							/>
							{#if dataSum > 0}
								<Tooltip.Item
									label="Percent"
									value={formatPercent(Number(data[yKey]) / dataSum)}
									valueAlign="right"
								/>
							{/if}
						</Tooltip.List>
					</Tooltip.Root>
				</Chart>
			{/if}
		</div>
	{:else}
		<div class="flex h-[300px] items-center justify-center rounded-lg border border-gray-200">
			<p class="text-gray-500">No data available</p>
		</div>
	{/if}

	{#if display.description}
		<p class="mt-2 text-sm text-gray-500">{display.description}</p>
	{/if}
</div>
