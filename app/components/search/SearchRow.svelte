<script lang="ts">
    import { Color } from '@nativescript/core';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { formatDistance } from '~/helpers/formatter';
    import { isEInk } from '~/helpers/theme';
    import { colors } from '~/variables';
    import IconButton from '~/components/common/IconButton.svelte';

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    const dispatch = createEventDispatcher();
    export let item: { title?: string; subtitle?: string; distance?: number; style: { color?: string; icon: string } };
    /** icon of the trailing button, no button without it */
    export let actionIcon: string = null;
</script>

<!-- a result row: a tile tinted with the provider colour, title and address, distance -->
<gridlayout columns="auto,*,auto,auto" {...$$restProps} padding={actionIcon ? '0 4 0 12' : '0 16 0 12'} rippleColor={colorOnSurface} on:tap={() => dispatch('tap', item)}>
    <label
        backgroundColor={isEInk ? null : new Color(item.style.color || colorOnSurface).setAlpha(36).hex}
        borderColor={colorOnSurface}
        borderRadius={12}
        borderWidth={isEInk ? 1 : 0}
        color={isEInk ? colorOnSurface : item.style.color}
        fontFamily="osm"
        fontSize={20}
        height={40}
        text={item.style.icon}
        textAlignment="center"
        verticalAlignment="middle"
        verticalTextAlignment="center"
        width={40} />
    <stacklayout col={1} paddingLeft={12} paddingRight={8} verticalAlignment="middle">
        <label color={colorOnSurface} fontSize={15} fontWeight="bold" maxLines={1} text={item.title} />
        <label color={colorOnSurfaceVariant} fontSize={12} maxLines={1} text={item.subtitle} visibility={item.subtitle ? 'visible' : 'collapse'} />
    </stacklayout>
    <label col={2} color={colorOnSurfaceVariant} fontSize={12} text={item.distance ? formatDistance(item.distance) : null} verticalAlignment="middle" />
    <IconButton col={3} gray={true} text={actionIcon} visibility={actionIcon ? 'visible' : 'collapse'} on:tap={(event) => dispatch('action', { item, event })} />
</gridlayout>
