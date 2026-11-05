import { lc } from '@nativescript-community/l';
import { showBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
import addressFormatter from '@akylas/address-formatter';
import { VerticalPosition } from '@nativescript-community/ui-popover';
import { Application, type View } from '@nativescript/core';
import dayjs from 'dayjs';
import { get } from 'svelte/store';
import { langStore } from '~/helpers/locale';
import { openUrl } from '@nativescript/core/utils';
import { share } from '@akylas/nativescript-app-utils/share';
import { showError } from '@shared/utils/showError';
import { formatter } from '~/mapModules/ItemFormatter';
import { getMapContext, handleMapAction } from '~/mapModules/MapModule';
import { sortItemActions } from '~/mapModules/itemActionOrder';
import { featureItemActions, featureLeadingActions } from '~/mapModules/mapFeatures';
import type { IItem, Item } from '~/models/Item';
import { networkService } from '~/services/NetworkService';
import { hideLoading, openURL, showLoading, showPopoverMenu } from '~/utils/ui/index.common';

const Intent = __ANDROID__ ? android.content.Intent : undefined;

/** One entry of an item's action menu: everything it needs is the item it was built for. */
export interface ItemMenuAction {
    id: string;
    icon: string;
    name: string;
    /** the action needs the map: search should let go of the screen */
    leavesSearch?: boolean;
    run: () => void | Promise<void>;
}

export function openItemWikipedia(item: Item) {
    try {
        const props = item?.properties;
        if (props?.wikipedia) {
            openURL(`https://wikipedia.org/wiki/${props.wikipedia}`);
        } else if (props?.name) {
            openURL(`https://wikipedia.org/wiki/Special:Search?search=${props.name}`);
        }
    } catch (error) {
        showError(error);
    }
}

export function openItemInOpenStreetMap(item: Item) {
    try {
        if (item && !item.route && item.geometry.type === 'Point') {
            const [lon, lat] = item.geometry.coordinates;
            openURL(`https://www.openstreetmap.org/#map=${Math.round(getMapContext().getMap().camera().zoom())}/${lat}/${lon}`);
        }
    } catch (error) {
        showError(error);
    }
}

export function searchItemOnWeb(item: Item, canUseWebsite = true) {
    let query: string;
    try {
        const props = item?.properties;
        if (props) {
            query = formatter.getItemName(item) || formatter.getItemPositionToString(item);
            if (canUseWebsite && props.website) {
                query = props.website;
            } else if (props.address?.county && props.address?.county !== query) {
                query += ' ' + props.address.county;
            }
            DEV_LOG && console.log('searchWeb', query);
            if (query) {
                if (__ANDROID__) {
                    const intent = new Intent(Intent.ACTION_WEB_SEARCH);
                    intent.putExtra('query', query);
                    Application.android.startActivity.startActivity(intent);
                } else {
                    throw new Error();
                }
            }
        }
    } catch (err) {
        if (query) {
            openURL(`https://duckduckgo.com/?ks=s&ko=-2&kaj=m&k1=-1&q=${encodeURIComponent(query).toLowerCase().replace('/s+/g', '+')}`);
        }
    }
}

export async function showItemInformation(item: Item) {
    try {
        const ItemInfo = (await import('~/components/items/ItemInfo.svelte')).default;
        const hasOpenHours = __ANDROID__;
        await showBottomSheet({
            parent: getMapContext().getMainPage(),
            view: ItemInfo,
            peekHeight: hasOpenHours ? 300 : undefined,
            props: {
                item,
                height: hasOpenHours ? undefined : 300
            }
        });
    } catch (error) {
        showError(error);
    }
}

export function showItemAstronomy(item: Item) {
    if (item) {
        const positions = item.geometry.type === 'Point' ? item.geometry?.['coordinates'] : item.geometry?.['coordinates'][0];
        const name = formatter.getItemTitle(item);
        const subtitle = formatter.getItemSubtitle(item, name);
        handleMapAction('astronomy', { name, subtitle, location: { lat: positions[1], lon: positions[0] }, timezone: item.properties.timezone });
    }
}

function weatherUrl(scheme: string, item: Item) {
    if (item.geometry.type !== 'Point') {
        return null;
    }
    const [lon, lat] = item.geometry.coordinates;
    let url = `${scheme}://query?lat=${lat}&lon=${lon}&name=${formatter.getItemTitle(item)}`;
    if (item.properties.address) {
        url += `&address=${JSON.stringify(item.properties.address)}`;
    }
    return url;
}

export function openItemWeather(item: Item) {
    try {
        let url: string;
        if (__ANDROID__) {
            url = weatherUrl('weather', item);
        } else if (item.geometry.type === 'Point') {
            url = `https://weather.apple.com/?lat=${item.geometry.coordinates[1]}&lng=${item.geometry.coordinates[0]}`;
        }
        DEV_LOG && console.log('checkWeather', url);
        if (url) {
            openUrl(url);
        }
    } catch (err) {
        showError(err);
    }
}

/** Android only: the alternate weather app. */
export function openItemWeatherAlternate(item: Item) {
    if (__ANDROID__) {
        try {
            const url = weatherUrl('ossweather', item);
            if (url) {
                openUrl(url);
            }
        } catch (err) {
            showError(err);
        }
    }
}

/** The ways to share an item, in a menu at `anchor`: its file as GeoJSON or GPX, saved or sent, its address or position. */
export async function shareItem(item: Item, anchor: View, vertPos = VerticalPosition.ABOVE) {
    try {
        const options = [
            { name: lc('share_geoson'), data: 'share_geojson' },
            { name: lc('export_geoson'), data: 'export_geojson' }
        ];
        if (item.properties?.address) {
            options.unshift({ name: lc('address'), data: 'address' });
        }
        if (item.route) {
            if (item.analysis) {
                options.push({ name: lc('share_geoson_data'), data: 'share_geojson_data' });
            }
            options.push({ name: lc('share_gpx'), data: 'share_gpx' }, { name: lc('export_gpx'), data: 'export_gpx' });
        } else {
            options.push({ name: lc('position'), data: 'position' });
        }
        await showPopoverMenu({
            options,
            anchor,
            vertPos,
            onClose: async (result) => {
                if (!result) {
                    return;
                }
                const filename = dayjs().format('YYYY-MM-DDTHH-mm-ss');
                const itemsModule = getMapContext().mapModule('items');
                try {
                    switch (result.data) {
                        case 'address': {
                            const address = { ...item.properties.address };
                            if (!address.name) {
                                address.name = item.properties.name;
                            }
                            share({ message: addressFormatter.format(address, { fallbackCountryCode: get(langStore) }) }, { dialogTitle: lc('share') });
                            break;
                        }
                        case 'position':
                            shareItemPosition(item);
                            break;
                        case 'export_geojson':
                            showLoading();
                            await itemsModule.exportItemsAsGeoJSON([item], filename);
                            break;
                        case 'export_gpx':
                            showLoading();
                            await itemsModule.exportItemsAsGPX([item], filename);
                            break;
                        case 'share_geojson':
                            showLoading();
                            await itemsModule.shareItemsAsGeoJSON([item], filename);
                            break;
                        case 'share_geojson_data':
                            showLoading();
                            await itemsModule.shareItemsAsGeoJSON([item], filename, true);
                            break;
                        case 'share_gpx':
                            showLoading();
                            await itemsModule.shareItemsAsGPX([item], filename);
                            break;
                    }
                } catch (error) {
                    showError(error);
                } finally {
                    hideLoading();
                }
            }
        });
    } catch (error) {
        showError(error);
    }
}

export function shareItemPosition(item: Item) {
    return share({ message: formatter.getItemPositionToString(item) }, { dialogTitle: lc('share') });
}

/** The menu behind a search result: the actions of the selected-item sheet that only need the item itself. */
export function getItemMenuActions(item: Item): ItemMenuAction[] {
    if (!item) {
        return [];
    }
    const mapContext = getMapContext();
    const actions: ItemMenuAction[] = [{ id: 'information', icon: 'mdi-information-outline', name: lc('information'), run: () => showItemInformation(item) }];
    if (item.geometry?.type === 'Point') {
        const [lon, lat] = item.geometry.coordinates;
        actions.push({
            id: 'directions_from',
            icon: 'mdi-flag-outline',
            name: lc('directions_from_here'),
            leavesSearch: true,
            run: () => mapContext.mapModules.directionsPanel.addStartPoint({ lat, lon }, item.properties)
        });
        actions.push({
            id: 'directions',
            icon: 'mdi-directions',
            name: lc('directions'),
            leavesSearch: true,
            run: () => mapContext.mapModules.directionsPanel.addStartOrStopPoint({ lat, lon }, item.properties)
        });
    }
    if (!item.id && !item.route?.osmid) {
        actions.push({ id: 'save', icon: 'mdi-map-plus', name: lc('add'), leavesSearch: true, run: () => mapContext.saveItem(item) });
    }
    const leading = featureLeadingActions(item);
    if (item.route) {
        return sortItemActions(actions, leading);
    }
    if (item.properties?.name) {
        actions.push({ id: 'wikipedia', icon: 'mdi-wikipedia', name: lc('wikipedia'), run: () => openItemWikipedia(item) });
    }
    actions.push({ id: 'web', icon: 'mdi-web', name: lc('search_web'), run: () => searchItemOnWeb(item) });
    if (networkService.canCheckWeather) {
        actions.push({ id: 'weather', icon: 'mdi-weather-partly-cloudy', name: lc('weather'), run: () => openItemWeather(item) });
    }
    actions.push({ id: 'astronomy', icon: 'mdi-weather-night', name: lc('astronomy'), run: () => showItemAstronomy(item) });
    for (const featureAction of featureItemActions(item)) {
        actions.push({ id: featureAction.id, icon: featureAction.text, name: featureAction.tooltip, leavesSearch: featureAction.leavesSearch ?? true, run: () => featureAction.onTap() });
    }
    actions.push({
        id: 'share',
        icon: 'mdi-share-variant',
        name: lc('share'),
        run: async () => {
            await shareItemPosition(item);
        }
    });
    return sortItemActions(actions, leading);
}
