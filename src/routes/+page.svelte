<script lang="ts">
  import { authClient } from '$lib/auth-client';
  
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

<div class="max-w-3xl mx-auto p-8 text-center">
  <h1 class="text-3xl font-bold mb-6">Welcome to the SQL Dashboard</h1>
  
  {#if user}
    <div class="mt-8 p-4 border border-gray-200 rounded-lg shadow-sm">
      <p class="mb-4">Signed in as: {user.email}</p>
      <button 
        class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
        onclick={signOut}
      >
        Sign Out
      </button>
    </div>
  {:else}
    <div class="mt-8">
      <button 
        class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
        onclick={signInWithGoogle}
      >
        Sign in with Google
      </button>
    </div>
  {/if}
</div>
