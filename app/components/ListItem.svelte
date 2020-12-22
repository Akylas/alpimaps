<script lang="ts">
    import { GridLayout } from '@nativescript/core';
    import { createEventDispatcher } from 'svelte';
    import { primaryColor } from '~/variables';
    import { NativeViewElementNode } from 'svelte-native/dom';
    const dispatch = createEventDispatcher();

    let gridLayout: NativeViewElementNode<GridLayout>;

    export let title: string;
    export let sizeFactor: number = 1;
    export let subtitle: string;
    export let overText: string;
    export let date: string;
    export let rightIcon: string;
    export let rightButton: string;
    export let leftIcon: string;
    export let avatar: string;
    export let showBottomLine: boolean = true;

    export let overlineColor: string = '#5C5C5C';
    export let subtitleColor: string = '#676767';

    $: avatar && gridLayout && gridLayout.nativeView && gridLayout.nativeView.requestLayout();
</script>

<gridlayout bind:this={gridLayout}
    columns={`${16 * sizeFactor},auto,*,auto,${16 * sizeFactor}`}
    rows={`${16 * sizeFactor},auto,*,auto,${16 * sizeFactor}`}
    rippleColor={primaryColor}
    on:tap={(event) => dispatch('tap', event)}>
    <label
        visibility={!!leftIcon ? 'visible' : 'collapsed'}
        col="1"
        row="0"
        rowSpan="5"
        fontSize={24 * sizeFactor}
        marginRight={16 * sizeFactor}
        textAlignment="left"
        text={leftIcon}
        horizontalAlignment="left"
        verticalAlignment="center"
        color="#757575"
        class="mdi" />
    <image
        visibility={!!avatar ? 'visible' : 'collapsed'}
        col="1"
        row="1"
        rowSpan="3"
        width={40 * sizeFactor}
        height={40 * sizeFactor}
        marginRight={16 * sizeFactor}
        src={avatar}
        verticalAlignment="center" />
    <label
        col="2"
        row="1"
        fontSize={10 * sizeFactor}
        visibility={!!overText ? 'visible' : 'collapsed'}
        textTransform="uppercase"
        text={overText}
        verticalAlignment="center"
        color={overlineColor} />

    <label col="2" row="2" fontSize={17 * sizeFactor} text={title} textWrap="true" verticalAlignment="bottom" />
    <label
        visibility={!!subtitle ? 'visible' : 'collapsed'}
        col="2"
        row="3"
        fontSize={14 * sizeFactor}
        text={subtitle}
        verticalAlignment="top"
        color={subtitleColor}
        textWrap="true" />

    <label
        col="3"
        row="1"
        fontSize={14 * sizeFactor}
        visibility="(!!date)?'visible':'collapsed'"
        text={date}
        verticalAlignment={top} />
    <label
        col="3"
        row="1"
        rowSpan="3"
        visibility={!!rightIcon ? 'visible' : 'collapsed'}
        class="mdi"
        fontSize={24 * sizeFactor}
        textAlignment="right"
        color="#757575"
        text={rightIcon}
        verticalAlignment="center" />
    <!-- <MDRipple rowSpan="5" colSpan="5" /> -->
    <button
        variant="flat"
        col="3"
        row="1"
        rowSpan="3"
        visibility={!!rightButton ? 'visible' : 'collapsed'}
        class="icon-themed-btn"
        text={rightButton}
        verticalAlignment="center"
        on:tap={(event) => dispatch('rightTap', event)} />
    <absolutelayout
        visibility={!!showBottomLine ? 'visible' : 'collapsed'}
        row="4"
        colSpan="5"
        marginLeft="20"
        backgroundColor="#44ffffff"
        height="1"
        verticalAlignment="bottom" />
</gridlayout>
