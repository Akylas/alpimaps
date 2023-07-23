<script lang="ts">
    import { closePopover } from '@nativescript-community/ui-popover/svelte';
    import { TextField } from '@nativescript/core';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoLocation } from '~/handlers/GeoHandler';
    import { lc } from '~/helpers/locale';
    import { showError } from '~/utils/error';
    import { PhotonFeature } from './Features';
    import SearchCollectionView from './SearchCollectionView.svelte';
    import { widgetBackgroundColor } from '~/variables';

    let textField: NativeViewElementNode<TextField>;
    let loading = false;
    let collectionView: SearchCollectionView;
    let searchResults: PhotonFeature[] = [];
    let searchAsTypeTimer: NodeJS.Timeout;
    let currentSearchText: string;
    export let position: GeoLocation = undefined;
    export let width;
    export let height = 40;
    export let elevation = 0;
    export let margin = 0;

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

    function clearSearchTimeout() {
        if (searchAsTypeTimer) {
            clearTimeout(searchAsTypeTimer);
            searchAsTypeTimer = null;
        }
    }

    function close(item: PhotonFeature) {
        unfocus()
        clearSearchTimeout();
        closePopover(item);
    }
    function focus() {
        textField && textField.nativeView.requestFocus();
    }
    function unfocus() {
        textField && textField.nativeView.clearFocus();
    }
    onMount(() => {
        focus();
    });
    onDestroy(() => {
        unfocus();
    });
</script>

<!-- <page id="selectCity" actionBarHidden={true} on:navigatingTo={onNavigatingTo}> -->
<gesturerootview columns="auto">
    <gridlayout rows="auto,auto,240" {width} backgroundColor={$widgetBackgroundColor} borderRadius={8} {elevation} {margin}>
        <!-- <CActionBar title={lc('search')} modalWindow>
            <mdactivityIndicator busy={loading} verticalAlignment="middle" visibility={loading ? 'visible' : 'collapsed'} />
        </CActionBar> -->
        <textfield bind:this={textField} row={1} hint={lc('search')} floating="false" returnKeyType="search" on:textChange={onTextChange} on:loaded={focus} {height} padding="3 10 3 10" />
        <SearchCollectionView bind:this={collectionView} row={2} on:tap={(event) => close(event.detail.detail)} />
    </gridlayout>
</gesturerootview>
<!-- </page> -->
