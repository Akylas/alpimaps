<script lang="ts">
    import { closePopover } from '@nativescript-community/ui-popover/svelte';
    import { TextField, Utils } from '@nativescript/core';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoLocation } from '~/handlers/GeoHandler';
    import { lc } from '~/helpers/locale';
    import { showError } from '~/utils/showError';
    import { colors } from '~/variables';
    import { PhotonFeature } from './Features';
    import SearchCollectionView from './SearchCollectionView.svelte';
    $: ({ colorWidgetBackground } = $colors);

    let textField: NativeViewElementNode<TextField>;
    let loading = false;
    let collectionView: SearchCollectionView;
    const searchResults: PhotonFeature[] = [];
    let searchAsTypeTimer: NodeJS.Timeout;
    let currentSearchText: string;
    export let position: GeoLocation;
    export let width;
    export let height = 40;
    export let elevation = 0;
    export let margin = 0;
    export let query: string = null;

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
    <gridlayout backgroundColor={colorWidgetBackground} borderRadius={8} {elevation} {margin} rows="auto,auto,240" {width}>
        <!-- <CActionBar title={lc('search')} modalWindow>
            <mdactivityIndicator busy={loading} verticalAlignment="middle" visibility={loading ? 'visible' : 'collapse'} />
        </CActionBar> -->
        <textfield
            bind:this={textField}
            floating={false}
            {height}
            hint={lc('search')}
            padding="3 10 3 10"
            returnKeyType="search"
            row={1}
            text={query}
            on:unloaded={blurTextField}
            on:textChange={onTextChange}
            on:loaded={focus} />
        <SearchCollectionView bind:this={collectionView} row={2} on:tap={close} />
    </gridlayout>
</gesturerootview>
<!-- </page> -->
