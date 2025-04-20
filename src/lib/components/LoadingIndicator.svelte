<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	type Props = {
		currentStep: string;
		progressMessages: string[];
	};

	let { currentStep, progressMessages }: Props = $props();
</script>

<Card.Root class="bg-muted/50 mb-8">
	<Card.Content class="pt-6">
		<div class="mb-4 flex items-center gap-3">
			<div
				class="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
			></div>
			<span class="font-medium">{currentStep}</span>
		</div>

		{#each progressMessages as message}
			<div>{message}</div>
		{/each}
	</Card.Content>
</Card.Root>
