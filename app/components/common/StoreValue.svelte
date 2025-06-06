<!-- StoreValue.svelte -->
<script>
  export let store;
  let value;
  const unsubscribe = store.subscribe(v => value = v);
  import { onDestroy } from 'svelte';
  onDestroy(unsubscribe);
</script>

<slot {value} />
