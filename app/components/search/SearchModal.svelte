<script lang="ts">
    import { closePopover } from '@nativescript-community/ui-popover/svelte';
    import { TextField, Utils } from '@nativescript/core';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { GeoLocation } from '~/handlers/GeoHandler';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { showError } from '@shared/utils/showError';
    import { colors, fonts } from '~/variables';
    import IconButton from '~/components/common/IconButton.svelte';
    import { PhotonFeature } from './Features';
    import type { SearchRankMode } from '~/utils/searchRank';
    import SearchCollectionView from './SearchCollectionView.svelte';
    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant, colorPanel, colorSurfaceFill } = $colors);

    let textField: NativeViewElementNode<TextField>;
    let loading = false;
    let collectionView: SearchCollectionView;
    const searchResults: PhotonFeature[] = [];
    let searchAsTypeTimer: NodeJS.Timeout;
    export let position: GeoLocation;
    export let width;
    export let height = 44;
    export let elevation = 0;
    export let margin = 0;
    export let query: string = null;
    export let rankMode: SearchRankMode = 'poi';
    let currentSearchText: string = query;

    // function focus() {
    //     textField && textField.nativeView.requestFocus();
    //     // alert('test')
    // }
    function onTextChange(e) {
        const query = e.value;
        clearSearchTimeout();

        if (query && query.length > 2) {
            searchAsTypeTimer = setTimeout(() => {
                searchAsTypeTimer = null;
                search(query);
            }, 500);
        } else if (currentSearchText && currentSearchText.length > 2) {
            clearSearchTimeout();
        }
        currentSearchText = query;
    }
    async function search(q) {
        try {
            loading = true;

            await collectionView?.instantSearch(q, position);
        } catch (err) {
            showError(err);
        } finally {
            loading = false;
        }
    }

    function onReturnPress() {
        clearSearchTimeout();
        if (currentSearchText && currentSearchText.length > 2) {
            search(currentSearchText);
        }
    }
    function clearText() {
        clearSearchTimeout();
        currentSearchText = null;
        if (textField) {
            textField.nativeView.text = '';
        }
        collectionView?.clearSearch();
    }

    function clearSearchTimeout() {
        if (searchAsTypeTimer) {
            clearTimeout(searchAsTypeTimer);
            searchAsTypeTimer = null;
        }
    }

    function close(item) {
        unfocus();
        clearSearchTimeout();
        closePopover(item as PhotonFeature);
    }
    function focus() {
        textField && textField.nativeView.requestFocus();
    }
    function unfocus() {
        textField && textField.nativeView.clearFocus();
    }
    onMount(() => {
        focus();
        if (query) {
            search(query);
        }
    });
    onDestroy(() => {
        unfocus();
    });
    function blurTextField(event?) {
        Utils.dismissSoftInput(event?.object.nativeViewProtected || textField?.nativeView?.nativeViewProtected);
    }
</script>

<!-- <page id="selectCity" actionBarHidden={true} on:navigatingTo={onNavigatingTo}> -->
<gesturerootview columns="auto">
    <gridlayout backgroundColor={colorPanel} borderColor={colorHairline} borderRadius={24} borderWidth={1} {elevation} {margin} rows="auto,240" {width}>
        <!-- the filled bar of the option sheets' search, with a busy indicator while it looks -->
        <gridlayout backgroundColor={colorSurfaceFill} borderColor={isEInk ? colorOnSurface : null} borderRadius={22} borderWidth={isEInk ? 1 : 0} columns="auto,*,auto,auto" {height} margin="4 8">
            <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} padding="0 4 0 14" text="mdi-magnify" verticalAlignment="middle" />
            <textfield
                bind:this={textField}
                autocapitalizationType="none"
                backgroundColor="transparent"
                col={1}
                color={colorOnSurface}
                floating={false}
                hint={lc('search')}
                padding="0 4"
                placeholder={lc('search')}
                returnKeyType="search"
                text={query}
                variant="none"
                verticalTextAlignment="center"
                on:loaded={focus}
                on:returnPress={onReturnPress}
                on:textChange={onTextChange}
                on:unloaded={blurTextField} />
            <activityindicator busy={true} col={2} height={20} margin="0 8" visibility={loading ? 'visible' : 'collapse'} width={20} />
            <IconButton col={3} color={colorOnSurfaceVariant} isVisible={!!currentSearchText?.length && !loading} size={40} text="mdi-close" verticalAlignment="middle" on:tap={clearText} />
        </gridlayout>
        <SearchCollectionView bind:this={collectionView} {rankMode} row={1} showItemMenu={false} on:tap={close} />
    </gridlayout>
</gesturerootview>
<!-- </page> -->
