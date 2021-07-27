<script lang="typescript">
    import { Frame } from '@nativescript/core/ui/frame';
    import { onMount } from 'svelte';
    import { closeModal, goBack } from 'svelte-native';
    import { textColor } from '~/variables';

    export let color: string = null;
    export let title: string = null;
    export let showMenuIcon: boolean = false;
    export let canGoBack: boolean = false;
    export let modalWindow: boolean = false;
    export let disableBackButton: boolean = false;
    export let onClose: Function = null;
    let menuIcon: string;
    let menuIconVisible: boolean;
    let menuIconVisibility: 'hidden' | 'visible' | 'collapse' | 'collapsed';

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
            menuIcon = canGoBack ? (global.isIOS ? 'mdi-chevron-left' : 'mdi-arrow-left') : 'mdi-menu';
        }
    }
    $: menuIconVisible = ((canGoBack || modalWindow) && !disableBackButton) || showMenuIcon;
    $: menuIconVisibility = menuIconVisible ? 'visible' : 'collapsed';
</script>

<gridLayout class="actionBar" columns="auto,*, auto" rows="*" paddingLeft="5" paddingRight="5" {...$$restProps} color={color || $textColor}>
    <label id="title" col={1} colSpan="3" class="actionBarTitle" textAlignment="left" visibility={!!title ? 'visible' : 'hidden'} text={title || ''} verticalTextAlignment="center" />
    <slot name="center" />
    <stackLayout orientation="horizontal">
        <slot name="left" />
        <button variant="text" visibility={menuIconVisibility} class="icon-btn" text={menuIcon} on:tap={onMenuIcon} />
    </stackLayout>
    <stackLayout col={2} orientation="horizontal">
        <slot />
    </stackLayout>
</gridLayout>
