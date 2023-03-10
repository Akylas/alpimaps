<script lang="ts">
    import { closePopover } from '@nativescript-community/ui-popover/svelte';
    import { TextField } from '@nativescript/core';
    import { onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoLocation } from '~/handlers/GeoHandler';
    import { lc } from '~/helpers/locale';
    import { showError } from '~/utils/error';
    import { PhotonFeature } from './Features';
    import SearchCollectionView from './SearchCollectionView.svelte';

    let textField: NativeViewElementNode<TextField>;
    let loading = false;
    let collectionView: SearchCollectionView;
    let searchResults: PhotonFeature[] = [];
    let searchAsTypeTimer: NodeJS.Timeout;
    let currentSearchText: string;
    export let position: GeoLocation = undefined;
    export let width;

    // function focus() {
    //     textField && textField.nativeView.requestFocus();
    //     // alert('test')
    // }
    function unfocus() {
        clearSearchTimeout();
    }
    function onTextChange(e) {
        const query = e.value;
        clearSearchTimeout();

        if (query && query.length > 2) {
            searchAsTypeTimer = setTimeout(() => {
                searchAsTypeTimer = null;
                search(query);
            }, 500);
        } else if (currentSearchText && currentSearchText.length > 2) {
            unfocus();
        }
        currentSearchText = query;
    }
    async function search(q) {
        try {
            loading = true;

            await collectionView?.instantSearch(q);
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
        clearSearchTimeout();
        closePopover(item);
    }
    onMount(() => {
        focus();
    });
</script>

<!-- <page id="selectCity" actionBarHidden={true} on:navigatingTo={onNavigatingTo}> -->
<gesturerootview>
    <gridlayout rows="auto,auto,100" {width} backgroundColor="white" borderRadius={8}>
        <!-- <CActionBar title={lc('search')} modalWindow>
            <mdactivityIndicator busy={loading} verticalAlignment="middle" visibility={loading ? 'visible' : 'collapsed'} />
        </CActionBar> -->
        <textfield bind:this={textField} row={1} hint={lc('search')} floating="false" returnKeyType="search" on:textChange={onTextChange} on:loaded={focus} />
        <SearchCollectionView bind:this={collectionView} row={2} on:tap={(event) => close(event.detail)} rowHeight={56} />
    </gridlayout>
</gesturerootview>
<!-- </page> -->
