<script lang="ts" context="module">
</script>

<script lang="ts">
    import DirectionSettings from './DirectionSettings.svelte';
</script>

<gesturerootview columns="auto">
    <DirectionSettings {...$$restProps} {...$$props}/>
</gesturerootview>
