<script lang="ts">
    import { primaryColor } from '~/variables';
    export let selected: boolean = false;
</script>

<label
    class="mdi"
    backgroundColor={primaryColor}
    color="white"
    text="mdi-check"
    fontSize={16}
    width={20}
    height={20}
    borderRadius={10}
    textAlignment="center"
    verticalTextAlignment="center"
    verticalAlignment="top"
    horizontalAlignment="left"
    margin={10}
    visibility={selected ? 'visible' : 'hidden'}
    {...$$restProps}
/>
