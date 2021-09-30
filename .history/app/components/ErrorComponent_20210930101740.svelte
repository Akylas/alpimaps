<script lang="ts">
    export let error: Error =null;
</script>

<slot>
    {#if error}
        <stacklayout>
            <label class="error" text={error.message} />
            <label class="stack" text={error.stack} />
        </stacklayout>
    {/if}
</slot>

<style>
    .error {
        border: 1px solid red;
    }
    .trace {
        font-family: monospace;
    }
</style>
