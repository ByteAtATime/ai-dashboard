<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';

	let { dashboards } = $page.data;
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<header class="mb-6">
		<h1 class="text-3xl font-bold">My Dashboards</h1>
		<p class="text-muted-foreground mt-2 text-lg">View and manage your saved dashboards</p>
	</header>

	<div class="grid gap-6">
		{#if dashboards.length === 0}
			<Card.Root class="p-8 text-center">
				<Card.Header>
					<Card.Title>No dashboards yet</Card.Title>
					<Card.Description>
						You haven't created any dashboards yet. Generate a dashboard in the query page and save
						it.
					</Card.Description>
				</Card.Header>
				<Card.Footer class="justify-center pt-4">
					<Button onclick={() => goto('/query')}>Create Dashboard</Button>
				</Card.Footer>
			</Card.Root>
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Created</Table.Head>
						<Table.Head class="text-right">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each dashboards as dashboard (dashboard.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{dashboard.name}</Table.Cell>
							<Table.Cell>{formatDate(dashboard.createdAt)}</Table.Cell>
							<Table.Cell class="text-right">
								<Button variant="outline" size="sm" href="/dashboards/{dashboard.id}">View</Button>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</div>
</div>
