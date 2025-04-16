<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import * as Card from '$lib/components/ui/card';
	import * as Button from '$lib/components/ui/button';

	const { data } = $props();
	const user = $derived(data.user);

	async function signInWithGoogle() {
		await authClient.signIn.social({
			provider: 'google'
		});
	}

	async function signOut() {
		await authClient.signOut();
	}
</script>

<div class="container mx-auto max-w-3xl p-8 text-center">
	<h1 class="mb-6 text-3xl font-bold">Welcome to the SQL Dashboard</h1>

	{#if user}
		<Card.Card class="mt-8">
			<Card.CardContent class="pt-6">
				<p class="mb-4">Signed in as: {user.email}</p>
				<Button.Button variant="default" onclick={signOut}>Sign Out</Button.Button>
			</Card.CardContent>
		</Card.Card>
	{:else}
		<div class="mt-8">
			<Button.Button variant="default" onclick={signInWithGoogle}>
				Sign in with Google
			</Button.Button>
		</div>
	{/if}
</div>
