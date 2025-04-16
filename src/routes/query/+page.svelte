<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import type {
		TableDisplay,
		StatDisplay,
		DisplayConfig,
		QueryContext
	} from '$lib/server/openrouter';

	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import { Alert } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';
	import { cn } from '$lib/utils';

	let query = $state('');
	let followupInstruction = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let displayConfigs = $state<(DisplayConfig & { results: any[] })[]>([]);
	let progressMessages = $state<string[]>([]);
	let sqls = $state<string[]>([]);
	let showSql = $state(false);
	let currentStep = $state('');
	let showFollowup = $state(false);
	let previousContext = $state<QueryContext | null>(null);
	let originalQuery = $state('');

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

							sqls = displayConfigs.map((config) => config.sql);
							currentStep = 'Complete';

							previousContext = {
								query: query,
								display: displayConfigs,
								explanation: data.data.explanation
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
		originalQuery = previousContext.query;

		try {
			const response = await fetch('/api/query/followup/stream', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					followupInstruction,
					previousContext
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
								query: followupInstruction,
								display: displayConfigs,
								explanation: data.data.explanation
							};

							followupInstruction = '';
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

	function resetQuery() {
		query = '';
		followupInstruction = '';
		displayConfigs = [];
		sqls = [];
		error = '';
		progressMessages = [];
		showFollowup = false;
		previousContext = null;
		originalQuery = '';
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

	<div class="mb-8 border-b pb-6">
		{#if !showFollowup || !displayConfigs.length}
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
						<Button type="button" onclick={toggleSql} variant="secondary" class="ml-auto">
							{showSql ? 'Hide SQL' : 'Show SQL'}
						</Button>
					{/if}
				</div>
			</form>
		{:else}
			<!-- Follow-up query form -->
			<div class="space-y-3">
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
						<Button type="button" onclick={resetQuery} variant="outline" disabled={isLoading}>
							New Query
						</Button>
						{#if sqls.length > 0}
							<Button type="button" onclick={toggleSql} variant="secondary" class="ml-auto">
								{showSql ? 'Hide SQL' : 'Show SQL'}
							</Button>
						{/if}
					</div>
				</form>
			</div>
		{/if}
	</div>

	{#if error}
		<Alert variant="destructive" class="mb-6">
			<span>{error}</span>
		</Alert>
	{/if}

	{#if isLoading}
		<Card.Root class="bg-muted/50 mb-8">
			<Card.Content class="pt-6">
				<div class="mb-4 flex items-center gap-3">
					<div
						class="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
					></div>
					<span class="font-medium">{currentStep}</span>
				</div>

				{#each progressMessages as message, i}
					<div>{message}</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if sqls.length > 0 && showSql}
		<Card.Root class="bg-card mb-8">
			<Card.Header class="bg-muted/50 py-3">
				<div class="flex items-center justify-between">
					<Card.Title class="text-base">Generated SQL</Card.Title>
					{#if sqls.length > 1}
						<span class="bg-muted rounded-full px-2.5 py-1 text-xs">{sqls.length} Queries</span>
					{/if}
				</div>
			</Card.Header>
			<Card.Content class="pt-4">
				{#each sqls as sql, index}
					<div class="mb-4 last:mb-0">
						{#if sqls.length > 1}
							<p class="text-muted-foreground mb-1.5 text-xs font-medium">Query {index + 1}:</p>
						{/if}
						<pre
							class="bg-muted overflow-x-auto rounded-md p-3 font-mono text-sm whitespace-pre-wrap">{sql}</pre>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if displayConfigs.length > 0}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			{#each displayConfigs as config, i}
				{#if config.type === 'table'}
					<Card.Root class="overflow-hidden lg:col-span-12">
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
					<Card.Root class="transition-all hover:shadow-md sm:col-span-6 lg:col-span-4">
						<Card.Header class="pb-2">
							<Card.Title class="text-muted-foreground text-sm font-medium"
								>{(config as StatDisplay).name}</Card.Title
							>
						</Card.Header>
						<Card.Content>
							<div class="flex items-baseline">
								<span class="text-3xl font-bold">
									{config.results[0]?.[config.id] ?? 'N/A'}
								</span>
								{#if (config as StatDisplay).unit}
									<span class="text-muted-foreground ml-1 text-xl"
										>{(config as StatDisplay).unit}</span
									>
								{/if}
							</div>
							{#if (config as StatDisplay).description}
								<p class="text-muted-foreground mt-3 text-sm">
									{(config as StatDisplay).description}
								</p>
							{/if}
						</Card.Content>
					</Card.Root>
				{/if}
			{/each}
		</div>
	{/if}
</div>
