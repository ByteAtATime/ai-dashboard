<script lang="ts">
	import { onMount } from 'svelte';
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
	import { Checkbox } from '$lib/components/ui/checkbox';

	type DataSource = {
		id: string;
		name: string;
		connectionString: string;
		isDefault: boolean;
		createdAt: string;
		updatedAt: string;
	};

	let dataSources: DataSource[] = [];
	let loading = true;
	let error = '';

	// Form data
	let name = '';
	let connectionString = '';
	let isDefault = false;
	let isDialogOpen = false;
	let isSubmitting = false;

	// Load data sources on mount
	onMount(async () => {
		try {
			const response = await fetch('/api/datasources');
			if (!response.ok) throw new Error('Failed to fetch data sources');
			dataSources = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load data sources';
		} finally {
			loading = false;
		}
	});

	// Add new data source
	async function addDataSource() {
		if (!name || !connectionString) return;

		isSubmitting = true;
		try {
			const response = await fetch('/api/datasources', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, connectionString, isDefault })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create data source');
			}

			const newDataSource = await response.json();
			dataSources = [...dataSources, newDataSource];

			// Reset form
			name = '';
			connectionString = '';
			isDefault = false;
			isDialogOpen = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create data source';
		} finally {
			isSubmitting = false;
		}
	}

	async function deleteDataSource(id: string) {
		try {
			const response = await fetch(`/api/datasources/${id}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to delete data source');

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
					<DialogDescription>Add a new database connection.</DialogDescription>
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
					<div class="flex items-center space-x-2">
						<Checkbox id="isDefault" bind:checked={isDefault} />
						<Label for="isDefault">Set as default</Label>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onclick={() => (isDialogOpen = false)}>Cancel</Button>
					<Button disabled={isSubmitting} onclick={addDataSource}>
						{isSubmitting ? 'Adding...' : 'Add Data Source'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>

	{#if error}
		<div class="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
			{error}
		</div>
	{/if}

	<Card>
		<CardHeader>
			<CardTitle>Your Data Sources</CardTitle>
			<CardDescription>Manage your database connections</CardDescription>
		</CardHeader>
		<CardContent>
			{#if loading}
				<div class="py-4 text-center">Loading...</div>
			{:else if dataSources.length === 0}
				<div class="text-muted-foreground py-4 text-center">
					No data sources found. Add your first database connection.
				</div>
			{:else}
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Connection String</TableHead>
							<TableHead>Default</TableHead>
							<TableHead class="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each dataSources as ds (ds.id)}
							<TableRow>
								<TableCell>{ds.name}</TableCell>
								<TableCell>
									<div class="max-w-md truncate">
										{ds.connectionString}
									</div>
								</TableCell>
								<TableCell>{ds.isDefault ? 'Yes' : 'No'}</TableCell>
								<TableCell class="text-right">
									<Button variant="destructive" size="sm" onclick={() => deleteDataSource(ds.id)}>
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
