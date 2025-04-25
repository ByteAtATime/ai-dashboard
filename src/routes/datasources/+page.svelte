<script lang="ts">
	// Removed onMount, fetch happens in load or $effect
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	// Checkbox removed

	// Updated DataSource type
	type DataSource = {
		id: string;
		userId: string; // Keep track of creator if needed, though maybe not displayed
		organizationId: string; // Added
		name: string;
		connectionString: string;
		// isDefault removed
		createdAt: string;
		updatedAt: string;
	};

	// Use $state for reactive variables
	let dataSources = $state<DataSource[]>([]);
	let loading = $state(true);
	let error = $state('');

	// Form data using $state
	let name = $state('');
	let connectionString = $state('');
	// isDefault removed
	let isDialogOpen = $state(false);
	let isSubmitting = $state(false);

	// Load data sources using $effect (runs on mount and potentially later if needed)
	$effect(() => {
		// Wrap async logic in a self-invoking function to return void
		(async () => {
			loading = true;
			error = '';
			try {
				const response = await fetch('/api/datasources'); // Endpoint remains the same
				if (!response.ok) throw new Error('Failed to fetch data sources');
				dataSources = await response.json();
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to load data sources';
				dataSources = []; // Clear data on error
			} finally {
				loading = false;
			}
		})(); // Immediately invoke the async function
	});

	// Add new data source
	async function addDataSource() {
		if (!name || !connectionString) return;

		isSubmitting = true;
		error = '';
		try {
			const response = await fetch('/api/datasources', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				// Remove isDefault from body
				body: JSON.stringify({ name, connectionString })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create data source');
			}

			const newDataSource = await response.json();
			// Svelte 5 reactivity handles the update automatically if `dataSources` is mutated
			dataSources.push(newDataSource);

			// Reset form
			name = '';
			connectionString = '';
			// isDefault removed
			isDialogOpen = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create data source';
		} finally {
			isSubmitting = false;
		}
	}

	async function deleteDataSource(id: string) {
		error = '';
		try {
			const response = await fetch(`/api/datasources/${id}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to delete data source');

			// Filter the array, reactivity handles the UI update
			dataSources = dataSources.filter((ds) => ds.id !== id);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete data source';
		}
	}
</script>

<div class="container mx-auto py-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Data Sources</h1>

		<Dialog bind:open={isDialogOpen}>
			<DialogTrigger class={buttonVariants()}>Add Data Source</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Data Source</DialogTitle>
					<DialogDescription
						>Add a new database connection for the current organization.</DialogDescription
					>
				</DialogHeader>

				<div class="grid gap-4 py-4">
					<div class="grid gap-2">
						<Label for="name">Name</Label>
						<Input id="name" bind:value={name} placeholder="Production Database" />
					</div>
					<div class="grid gap-2">
						<Label for="connection">Connection String</Label>
						<Input
							id="connection"
							bind:value={connectionString}
							placeholder="postgresql://user:password@localhost:5432/db"
						/>
					</div>
					<!-- Default checkbox removed -->
				</div>

				<DialogFooter>
					<Button variant="outline" onclick={() => (isDialogOpen = false)}>Cancel</Button>
					<Button disabled={isSubmitting || !name || !connectionString} onclick={addDataSource}>
						{isSubmitting ? 'Adding...' : 'Add Data Source'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>

	{#if error}
		<div class="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700" role="alert">
			{error}
		</div>
	{/if}

	<Card>
		<CardHeader>
			<CardTitle>Your Data Sources</CardTitle>
			<CardDescription>Database connections for the current organization</CardDescription>
		</CardHeader>
		<CardContent>
			{#if loading}
				<div class="py-4 text-center">Loading...</div>
			{:else if dataSources.length === 0}
				<div class="text-muted-foreground py-4 text-center">
					No data sources found for this organization. Add your first connection.
				</div>
			{:else}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Connection String (Partial)</TableHead>
							<!-- Default column removed -->
							<TableHead class="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each dataSources as ds (ds.id)}
							<TableRow>
								<TableCell class="font-medium">{ds.name}</TableCell>
								<TableCell>
									<div class="max-w-md truncate" title={ds.connectionString}>
										{ds.connectionString.split('@')[0]}@... <!-- Show only user part -->
									</div>
								</TableCell>
								<!-- Default cell removed -->
								<TableCell class="text-right">
									<Button
										variant="ghost"
										size="sm"
										class="text-red-500 hover:text-red-700"
										onclick={() => deleteDataSource(ds.id)}
									>
										Delete
									</Button>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			{/if}
		</CardContent>
	</Card>
</div>
