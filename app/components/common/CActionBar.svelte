<script lang="ts">
    import { Frame } from '@nativescript/core/ui/frame';
    import { onMount } from 'svelte';
    import { closeModal, goBack } from 'svelte-native';
    import { actionBarHeight, colors, statusBarHeight } from '~/variables';
    import IconButton from './IconButton.svelte';
    import { showError } from '~/utils/error';
    $: ({ colorOnSurface } = $colors);

    export let color: string = colorOnSurface;
    export let title: string = null;
    export let showMenuIcon: boolean = false;
    export let height = $actionBarHeight;
    export let paddingTop = $statusBarHeight;
    export let canGoBack: boolean = false;
    export let forceCanGoBack: boolean = false;
    export let modalWindow: boolean = false;
    export let disableBackButton: boolean = false;
    export let onClose: Function = null;
    export let onGoBack: Function = null;
    let menuIcon: string;
    let menuIconVisible: boolean;

    onMount(() => {
        // setTimeout(() => {
        canGoBack = Frame.topmost() && (Frame.topmost().canGoBack() || !!Frame.topmost().currentEntry);
        // }, 0);
    });
    function onMenuIcon() {
        try {
            if (onGoBack) {
                onGoBack();
            } else if (modalWindow) {
                if (onClose) {
                    onClose();
                } else {
                    closeModal(undefined);
                }
            } else {
                goBack();
            }
        } catch (error) {
            showError(error);
        }
    }
    $: {
        if (modalWindow) {
            menuIcon = 'mdi-close';
        } else {
            menuIcon = forceCanGoBack || canGoBack ? (__IOS__ ? 'mdi-chevron-left' : 'mdi-arrow-left') : 'mdi-menu';
        }
    }
    $: menuIconVisible = ((forceCanGoBack || canGoBack || modalWindow) && !disableBackButton) || showMenuIcon;
</script>

<gridlayout class="actionBar" {color} columns="auto,*,auto" {paddingTop} rows={`${height},auto`} {...$$restProps} on:tap={() => {}}>
    <label id="title" class="actionBarTitle" col={1} colSpan={3} text={title || ''} textAlignment="left" verticalTextAlignment="center" visibility={!!title ? 'visible' : 'hidden'} />
    <slot name="center" />
    <stacklayout orientation="horizontal">
        <slot name="left" />
        <IconButton color="white" isVisible={menuIconVisible} text={menuIcon} on:tap={onMenuIcon} />
    </stacklayout>
    <stacklayout col={2} orientation="horizontal">
        <slot />
    </stacklayout>

    <!-- <stacklayout colSpan={3} row={1}> -->
        <slot name="bottom" />
    <!-- </stacklayout> -->
</gridlayout>
