<script lang="ts">
    import { Frame } from '@nativescript/core';
    import { createEventDispatcher, onMount } from 'svelte';
    import { goBack } from 'svelte-native';
    import { actionBarHeight } from '~/variables';

    const dispatch = createEventDispatcher();

    export let title: string;
    export let height: number = actionBarHeight;
    export let subtitle: string;
    export let showMenuIcon: boolean = false;
    export let modalWindow: boolean = false;
    export let canGoBack = false;

    let menuIcon: string = 'mdi-menu';
    let menuIconVisible: boolean = true;

    $: {
        if (modalWindow) {
            menuIcon = 'mdi-close';
        } else if (canGoBack) {
            menuIcon = global.isIOS ? 'mdi-chevron-left' : 'mdi-arrow-left';
        } else {
            menuIcon = 'mdi-menu';
        }
    }
    $: {
        menuIconVisible = modalWindow || canGoBack || showMenuIcon;
    }

    onMount(() => {
        setTimeout(() => {
            canGoBack = Frame.topmost() && Frame.topmost().canGoBack();
        }, 0);
    });
    function onMenuIcon() {
        if (canGoBack) {
            return goBack();
        } else {
            dispatch('tapMenuIcon');
        }
    }
</script>

<gridlayout class="actionBar" columns="auto,*, auto" rows="auto,auto">
    <stacklayout col="1" colSpan="3" verticalAlignment="center" {height}>
        {#if title}<label class="actionBarTitle" textAlignment="left" text={title} />{/if}
        <label visibility={!!subtitle ? 'visible' : 'collapse'} textAlignment="left" class="actionBarSubtitle" text={subtitle} />
    </stacklayout>
    <contentview col="1" colSpan="2" {height}>
        <slot name="title" />
    </contentview>

    <stacklayout orientation="horizontal" col="2" verticalAlignment="top" {height}>
        <slot name="rightButtons" />
    </stacklayout>
    <contentview col="0" verticalAlignment="top" {height}>
        <button
            rippleColor="white"
            variant="text"
            visibility={menuIconVisible ? 'visible' : 'collapsed'}
            class="icon-btn"
            text={menuIcon}
            on:tap={onMenuIcon} />
    </contentview>
    <slot row="1" colSpan="3" name="subView" />
</gridlayout>
