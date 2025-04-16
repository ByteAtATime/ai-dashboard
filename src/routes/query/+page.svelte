<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import type { TableDisplay, StatDisplay, DisplayConfig } from '$lib/server/openrouter';
	
	import { Button } from "$lib/components/ui/button";
	import { Textarea } from "$lib/components/ui/textarea";
	import * as Card from "$lib/components/ui/card";
	import { Alert } from "$lib/components/ui/alert";
	import { Separator } from "$lib/components/ui/separator";
	import { cn } from "$lib/utils";

	let query = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let displayConfigs = $state<(DisplayConfig & { results: any[] })[]>([]);
	let progressMessages = $state<string[]>([]);
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
	}
	
	function toggleSql() {
		showSql = !showSql;
	}
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<header class="mb-6">
		<h1 class="text-3xl font-bold">Data Explorer</h1>
		<p class="mt-2 text-lg text-muted-foreground">
			Ask questions about your data in plain English and get instant visualizations
		</p>
	</header>

	<div class="mb-8 border-b pb-6">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				submitQuery();
			}}
			class="space-y-4"
		>
			<Textarea
				bind:value={query}
				placeholder="Ask a question about your data (e.g., 'Show me the top 5 customers by revenue and their total order count')"
				rows={3}
				class="w-full"
			/>
			<div class="flex flex-wrap gap-3">
				<Button type="submit" disabled={isLoading}>
					{isLoading ? 'Processing...' : 'Run Query'}
				</Button>
				<Button
					type="button"
					onclick={resetQuery}
					variant="outline"
					disabled={isLoading || !query}
				>
					Clear
				</Button>
				{#if sqls.length > 0}
					<Button
						type="button"
						onclick={toggleSql}
						variant="secondary"
						class="ml-auto"
					>
						{showSql ? 'Hide SQL' : 'Show SQL'}
					</Button>
				{/if}
			</div>
		</form>
	</div>

	{#if error}
		<Alert variant="destructive" class="mb-6">
			<span>{error}</span>
		</Alert>
	{/if}

	{#if isLoading}
		<Card.Root class="mb-8 bg-muted/50">
			<Card.Content class="pt-6">
				<div class="flex items-center gap-3 mb-4">
					<div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
					<span class="font-medium">{currentStep}</span>
				</div>
				
				{#each progressMessages as message, i}
					<div>{message}</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if sqls.length > 0 && showSql}
		<Card.Root class="mb-8 bg-card">
			<Card.Header class="bg-muted/50 py-3">
				<div class="flex items-center justify-between">
					<Card.Title class="text-base">Generated SQL</Card.Title>
					{#if sqls.length > 1}
						<span class="px-2.5 py-1 rounded-full bg-muted text-xs">{sqls.length} Queries</span>
					{/if}
				</div>
			</Card.Header>
			<Card.Content class="pt-4">
				{#each sqls as sql, index}
					<div class="mb-4 last:mb-0">
						{#if sqls.length > 1}
							<p class="mb-1.5 text-xs font-medium text-muted-foreground">Query {index + 1}:</p>
						{/if}
						<pre class="font-mono text-sm whitespace-pre-wrap bg-muted p-3 rounded-md overflow-x-auto">{sql}</pre>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if displayConfigs.length > 0}
		<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
			{#each displayConfigs as config, i}
				{#if config.type === 'table'}
					<Card.Root class="lg:col-span-12 overflow-hidden">
						{#if (config as TableDisplay).description}
							<Card.Header class="py-3">
								<Card.Title class="text-base">{(config as TableDisplay).description}</Card.Title>
							</Card.Header>
							<Separator />
						{/if}
						<div class="overflow-x-auto">
							<DataTable data={config.results} columns={(config as TableDisplay).columns} />
						</div>
					</Card.Root>
				{:else if config.type === 'stat'}
					<Card.Root class="lg:col-span-4 sm:col-span-6 hover:shadow-md transition-all">
						<Card.Header class="pb-2">
							<Card.Title class="text-sm font-medium text-muted-foreground">{(config as StatDisplay).name}</Card.Title>
						</Card.Header>
						<Card.Content>
							<div class="flex items-baseline">
								<span class="text-3xl font-bold">
									{config.results[0]?.[config.id] ?? 'N/A'}
								</span>
								{#if (config as StatDisplay).unit}
									<span class="ml-1 text-xl text-muted-foreground">{(config as StatDisplay).unit}</span>
								{/if}
							</div>
							{#if (config as StatDisplay).description}
								<p class="mt-3 text-sm text-muted-foreground">{(config as StatDisplay).description}</p>
							{/if}
						</Card.Content>
					</Card.Root>
				{/if}
			{/each}
		</div>
	{/if}
</div>
