<script lang="ts">
    import { Page, TextField } from '@nativescript/core';
    import { closeModal } from 'svelte-native';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import type { Feature, Photon } from '~/photon';
    import CActionBar from '~/components/CActionBar.svelte';
    import { GeoLocation } from '~/handlers/GeoHandler';
    import { lc } from '~/helpers/locale';
    import { networkService } from '~/services/NetworkService';
    import { showError } from '~/utils/error';
    import { borderColor, subtitleColor, textColor, textLightColor } from '~/variables';
    import { lang } from '~/helpers/locale';
    import { PhotonFeature } from './Features';
    import { computeDistanceBetween } from '~/utils/geo';
    import { formatDistance, osmicon } from '~/helpers/formatter';
    import { onMount } from 'svelte';
    import { formatter } from '~/mapModules/ItemFormatter';

    let textField: NativeViewElementNode<TextField>;
    let loading = false;
    let searchResults: PhotonFeature[] = [];
    let searchAsTypeTimer: NodeJS.Timeout;
    let currentSearchText: string;
    export let position: GeoLocation;

    function focus() {
        textField && textField.nativeView.requestFocus();
        // alert('test')
    }
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
    function getItemIcon(item) {
        const icons = formatter.geItemIcon(item);
        return osmicon(icons);
    }
    function getItemTitle(item) {
        return formatter.getItemTitle(item);
    }
    function getItemSubtitle(item, title?: string) {
        return formatter.getItemSubtitle(item, title);
    }

    async function search(q) {
        try {
            loading = true;

            searchResults = (
                await networkService.request<Photon>({
                    url: 'https://photon.komoot.io/api',
                    method: 'GET',
                    queryParams: {
                        q,
                        lat: position?.lat,
                        lon: position?.lon,
                        lang,
                        limit: 40
                    }
                })
            ).features
                .map((f) => {
                    const r = new PhotonFeature(f);
                    if (position) {
                        r['distance'] = computeDistanceBetween(position, {
                            lat: r.geometry.coordinates[1],
                            lon: r.geometry.coordinates[0]
                        });
                    }
                    return r;
                })
                .map((s) => {
                    const title = getItemTitle(s);
                    return { ...s, icon: getItemIcon(s), title, subtitle: getItemSubtitle(s, title) };
                });
            // return results.features
            // .filter((r) => supportedOSMKeys.indexOf(r.properties.osm_key) !== -1 || supportedOSMValues.indexOf(r.properties.osm_value) !== -1)
            // .map(
            //     (f) =>
            //         ({
            //             name: f.properties.name,
            //             sys: f.properties,
            //             coord: { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }
            //         } as WeatherLocation)
            // );
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
        closeModal(item);
    }
    function onNavigatingTo(e) {
        // console.log('onNavigatingTo', page && page.nativeView, e.object);
    }
    onMount(() => {
        focus();
    });
</script>

<page id="selectCity" actionBarHidden={true} on:navigatingTo={onNavigatingTo}>
    <gridLayout rows="auto,auto,*">
        <CActionBar title={lc('search')} modalWindow>
            <mdactivityIndicator busy={loading} verticalAlignment="middle" visibility={loading ? 'visible' : 'collapsed'} />
        </CActionBar>
        <textfield bind:this={textField} row={1} hint={lc('search')} floating="false" returnKeyType="search" on:textChange={onTextChange} on:loaded={focus} />
        <collectionview row={2} rowHeight={80} items={searchResults}>
            <Template let:item>
                <canvaslabel
                    columns="34,*"
                    padding="0 10 0 10"
                    rows="*,auto,auto,*"
                    disableCss={true}
                    rippleColor={$textColor}
                    on:tap={() => close(item)}
                    borderBottomColor={$borderColor}
                    borderBottomWidth={1}
                >
                    <cspan text={item.icon} color={$textColor} fontFamily="osm" fontSize={30} verticalAlignment="middle" />
                    <cspan paddingLeft={40} verticalAlignment="middle" paddingBottom={item.subtitle ? 10 : 0} text={item.title} fontSize={16} fontWeight="bold" color={$textColor} />
                    <cspan
                        paddingLeft={40}
                        verticalAlignment="middle"
                        paddingTop={10}
                        text={item.subtitle}
                        color={$subtitleColor}
                        fontSize={14}
                        visibility={!!item.subtitle ? 'visible' : 'collapsed'}
                    />
                    <cspan
                        textAlignment="right"
                        verticalAlignment="middle"
                        paddingTop={10}
                        text={item.distance && formatDistance(item.distance)}
                        color={$subtitleColor}
                        fontSize={14}
                        visibility={'distance' in item ? 'visible' : 'collapsed'}
                    />
                </canvaslabel>
            </Template>
        </collectionview>
    </gridLayout>
</page>
