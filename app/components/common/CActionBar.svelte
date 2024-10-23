<script lang="ts">
    import { CoreTypes, Frame } from '@nativescript/core';
    import { onMount } from 'svelte';
    import { closeModal, goBack } from '@shared/utils/svelte/ui';
    import { actionBarHeight, colors, windowInset } from '~/variables';
    import { showError } from '@shared/utils/showError';
    $: ({ colorOnSurface } = $colors);
    $: ({ top: windowInsetTop } = $windowInset);

    export let title: string = null;
    export let showMenuIcon: boolean = false;
    export let height = null;
    export let paddingTop = null;
    export let canGoBack: boolean = false;
    export let forceCanGoBack: boolean = false;
    export let modalWindow: boolean = false;
    export let disableBackButton: boolean = false;
    export let onClose: Function = null;
    export let onGoBack: Function = null;
    let menuIcon: string;
    let menuIconVisible: boolean;
    export let labelsDefaultVisualState = null;
    export let buttonsDefaultVisualState = null;

    let menuIconVisibility: CoreTypes.VisibilityType;

    onMount(() => {
        const frame = Frame.topmost();
        canGoBack = frame?.canGoBack() || !!frame?.currentEntry;
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
                const frame = Frame.topmost();
                // this means the frame is animating
                // doing goBack would mean boing back up 2 levels because
                // the animating context is not yet in the backStack
                if (frame['_executingContext']) {
                    return;
                }
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
    $: menuIconVisibility = menuIconVisible ? 'visible' : 'collapse';
</script>

<gridlayout class="actionBar" columns="auto,*,auto" paddingTop={paddingTop || windowInsetTop} rows={`${height || $actionBarHeight},auto`} {...$$restProps} on:tap={() => {}}>
    <label
        id="actionBarTitle"
        class="actionBarTitle"
        col={1}
        colSpan={3}
        text={title || ''}
        textAlignment="left"
        verticalTextAlignment="center"
        visibility={!!title ? 'visible' : 'hidden'}
        {...$$restProps?.titleProps}
        defaultVisualState={labelsDefaultVisualState} />
    <slot name="center" />
    <stacklayout orientation="horizontal">
        <slot name="left" />
        <mdbutton class="actionBarButton" defaultVisualState={buttonsDefaultVisualState} text={menuIcon} variant="text" visibility={menuIconVisibility} on:tap={onMenuIcon} />
    </stacklayout>
    <stacklayout col={2} orientation="horizontal">
        <slot />
    </stacklayout>
    <slot name="bottom" />
</gridlayout>
