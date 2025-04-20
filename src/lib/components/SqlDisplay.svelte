<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	type Props = {
		sqls: string[];
	};

	let { sqls }: Props = $props();
</script>

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
