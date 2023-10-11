<script lang="ts">
    import { Frame } from '@nativescript/core/ui/frame';
    import { onMount } from 'svelte';
    import { closeModal, goBack } from 'svelte-native';
    import { actionBarHeight, statusBarHeight, textColor } from '~/variables';
    import IconButton from './IconButton.svelte';
    import { showError } from '~/utils/error';

    export let color: string = null;
    export let title: string = null;
    export let showMenuIcon: boolean = false;
    export let height = actionBarHeight;
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
                onClose ? onClose() : closeModal(undefined);
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

<gridlayout class="actionBar" columns="auto,*,auto" rows={`${height},auto`} {...$$restProps} color={color || $textColor} on:tap={() => {}} paddingTop={paddingTop}>
    <label id="title" col={1} colSpan={3} class="actionBarTitle" textAlignment="left" visibility={!!title ? 'visible' : 'hidden'} text={title || ''} verticalTextAlignment="center" />
    <slot name="center" />
    <stacklayout orientation="horizontal">
        <slot name="left" />
        <IconButton isVisible={menuIconVisible} text={menuIcon} on:tap={onMenuIcon} color="white" />
    </stacklayout>
    <stacklayout col={2} orientation="horizontal">
        <slot />
    </stacklayout>

    <stacklayout row={1} colSpan={3}>
        <slot name="bottom" />
    </stacklayout>
</gridlayout>
