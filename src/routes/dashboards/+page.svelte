<script lang="ts">
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Separator } from '$lib/components/ui/separator';
	import { goto } from '$app/navigation';
	import { formatDate } from '$lib/utils';

	// Get the dashboards data from the page store
	let { dashboards } = $page.data;

	function viewDashboard(id: string) {
		goto(`/dashboards/${id}`);
	}
</script>

<div class="container mx-auto max-w-6xl px-4 py-8">
	<header class="mb-6">
		<h1 class="text-3xl font-bold">My Dashboards</h1>
		<p class="text-muted-foreground mt-2 text-lg">View and manage your saved dashboards</p>
	</header>

	<Separator class="my-6" />

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
			<Card.Root>
				<Card.Header>
					<Card.Title>Your Dashboards</Card.Title>
					<Card.Description>A list of all your saved dashboards</Card.Description>
				</Card.Header>
				<Card.Content>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Name</Table.Head>
								<Table.Head>Created</Table.Head>
								<Table.Head class="text-right">Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each dashboards as dashboard}
								<Table.Row>
									<Table.Cell class="font-medium">{dashboard.name}</Table.Cell>
									<Table.Cell>{formatDate(dashboard.createdAt)}</Table.Cell>
									<Table.Cell class="text-right">
										<Button variant="outline" size="sm" onclick={() => viewDashboard(dashboard.id)}>
											View
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
</div>
