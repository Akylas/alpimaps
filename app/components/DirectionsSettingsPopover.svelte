<script context="module" lang="ts">
</script>

<script lang="ts">
    import DirectionSettings from './DirectionSettings.svelte';
</script>

<gesturerootview columns="auto">
    <DirectionSettings {...$$restProps} {...$$props}/>
</gesturerootview>
