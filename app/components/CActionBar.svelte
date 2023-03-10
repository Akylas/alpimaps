<script lang="ts">
    import { Frame } from '@nativescript/core/ui/frame';
    import { onMount } from 'svelte';
    import { closeModal, goBack } from 'svelte-native';
    import { actionBarHeight, statusBarHeight, textColor } from '~/variables';
    import IconButton from './IconButton.svelte';

    export let color: string = null;
    export let title: string = null;
    export let showMenuIcon: boolean = false;
    export let canGoBack: boolean = false;
    export let modalWindow: boolean = false;
    export let disableBackButton: boolean = false;
    export let onClose: Function = null;
    let menuIcon: string;
    let menuIconVisible: boolean;

    onMount(() => {
        setTimeout(() => {
            canGoBack = Frame.topmost() && Frame.topmost().canGoBack();
        }, 0);
    });
    function onMenuIcon() {
        if (modalWindow) {
            onClose ? onClose() : closeModal(undefined);
        } else {
            goBack();
        }
    }
    $: {
        if (modalWindow) {
            menuIcon = 'mdi-close';
        } else {
            menuIcon = canGoBack ? (__IOS__ ? 'mdi-chevron-left' : 'mdi-arrow-left') : 'mdi-menu';
        }
    }
    $: menuIconVisible = ((canGoBack || modalWindow) && !disableBackButton) || showMenuIcon;
</script>

<gridLayout
    class="actionBar"
    columns="auto,*, auto"
    rows="*"
    paddingLeft={5}
    paddingRight={5}
    {...$$restProps}
    color={color || $textColor}
    on:tap={() => {}}
    paddingTop={$statusBarHeight}
    height={$statusBarHeight + actionBarHeight}
>
    <label id="title" col={1} colSpan={3} class="actionBarTitle" textAlignment="left" visibility={!!title ? 'visible' : 'hidden'} text={title || ''} verticalTextAlignment="center" />
    <slot name="center" />
    <stackLayout orientation="horizontal">
        <slot name="left" />
        <IconButton isVisible={menuIconVisible} text={menuIcon} on:tap={onMenuIcon} />
    </stackLayout>
    <stackLayout col={2} orientation="horizontal">
        <slot />
    </stackLayout>
</gridLayout>
