<script lang="ts">
    // the outline carries the on state on e-ink, where a tint is invisible
    import type { Writable } from 'svelte/store';
    import { fonts } from '~/variables';

    export let store: Writable<boolean>;
    export let icon: string;
    export let label: string;
    export let colorOnSurface: string;
    export let colorAccent: string;
    export let colorAccentContainer: string;
    /** The small chips under a body, rather than a body's own pill. */
    export let small = false;

    $: on = $store;
</script>

<mdbutton
    backgroundColor={on ? colorAccentContainer : 'transparent'}
    borderColor={on ? colorAccent : colorOnSurface + '40'}
    borderRadius={small ? 16 : 22}
    borderWidth={1}
    color={on ? colorAccent : colorOnSurface}
    elevation={0}
    height={small ? 32 : 44}
    margin={small ? '2 4' : 4}
    padding={small ? '0 10' : '0 8'}
    rippleColor={colorAccent}
    textAlignment="center"
    variant="flat"
    verticalTextAlignment="center"
    {...$$restProps}
    on:tap={() => store.set(!on)}>
    <cspan fontFamily={$fonts.mdi} fontSize={small ? 15 : 19} text={icon} verticalAlignment="middle" />
    <cspan fontSize={small ? 12 : 14} fontWeight={on ? 'bold' : 'normal'} text={' ' + label} verticalAlignment="middle" />
</mdbutton>
