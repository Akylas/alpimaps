<script context="module" lang="ts">
    import { share } from '@akylas/nativescript-app-utils/share';
    import { isPermResultAuthorized, request } from '@nativescript-community/perms';
    import { SDK_VERSION } from '@nativescript-community/sentry';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { openFilePicker, pickFolder, saveFile } from '@nativescript-community/ui-document-picker';
    import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { alert, confirm, prompt } from '@nativescript-community/ui-material-dialogs';
    import { TextField, TextFieldProperties } from '@nativescript-community/ui-material-textfield';
    import { TextView } from '@nativescript-community/ui-material-textview';
    import { ApplicationSettings, Device, File, Folder, ScrollView, StackLayout, Utils, path } from '@nativescript/core';
    import BaseSettingsPage from '@shared/components/BaseSettingsPage.svelte';
    import { presentInAppSponsorBottomsheet } from '@shared/utils/inapp-purchase';
    import { Sentry, startSentry, stopSentry } from '@shared/utils/sentry';
    import { showError } from '@shared/utils/showError';
    import dayjs from 'dayjs';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { formatDistance } from '~/helpers/formatter';
    import { clock_24, getLocaleDisplayName, l, lc, onMapLanguageChanged, selectLanguage, selectMapLanguage, slc } from '~/helpers/locale';
    import { getColorThemeDisplayName, getThemeDisplayName, selectColorTheme, selectTheme } from '~/helpers/theme';
    import { UNITS, UNIT_FAMILIES } from '~/helpers/units';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { packageService } from '~/services/PackageService';
    import { getNavigationSettingsOptions } from '~/stores/navigationStore';
    import { clickHandlerLayerFilter, immersive, layerProps, useOfflineGeocodeAddress, useSystemGeocodeAddress } from '~/stores/mapStore';
    import {
        DEFAULT_TILE_SERVER_AUTO_START,
        DEFAULT_TILE_SERVER_PORT,
        DEFAULT_VALHALLA_MAX_DISTANCE_AUTO,
        DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE,
        DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN,
        DEFAULT_VALHALLA_ONLINE_URL,
        SETTINGS_ENABLE_CRASH_REPORT,
        SETTINGS_IMPERIAL,
        SETTINGS_TILE_SERVER_AUTO_START,
        SETTINGS_TILE_SERVER_PORT,
        SETTINGS_UNITS,
        SETTINGS_VALHALLA_MAX_DISTANCE_AUTO,
        SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE,
        SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN,
        SETTINGS_VALHALLA_MAX_DISTANCE_TRACE,
        SETTINGS_VALHALLA_ONLINE_URL
    } from '~/utils/constants';
    import { showSnack } from '~/utils/ui';
    import { confirmRestartApp, createView, hideLoading, openLink, showLoading } from '~/utils/ui/index.common';
    import { ANDROID_30, getAndroidRealPath, getItemsDataFolder, getSavedMBTilesDir, moveFileOrFolder, resetItemsDataFolder, setItemsDataFolder, setSavedMBTilesDir } from '~/utils/utils';
    import { fonts, imperial, unitsSettings } from '~/variables';

    const version = __APP_VERSION__ + ' Build ' + __APP_BUILD_NUMBER__;

    const numberTextFieldProperties = {
        keyboardType: 'number',
        autocapitalizationType: 'none',
        autocorrect: false
    } as TextFieldProperties;
    const textTextFieldProperties = {
        autocapitalizationType: 'none',
        autocorrect: false
    } as TextFieldProperties;

    const formatMilliseconds = (value: number) => value + ' ms';

    /** the a9 watch needs its screen woken for the gps to keep reporting: nobody else has that quirk */
    const isA9Watch = __ANDROID__ && Device.model === 'HLTE556N';
    const dataPathsAvailable = __ANDROID__ && !PLAY_STORE_BUILD && ANDROID_30;
</script>

<script lang="ts">
    let settingsPage: BaseSettingsPage;

    export let title = null;
    export let id = 'settingsPage';
    export let actionBarButtons = [
        { icon: 'mdi-share-variant', id: 'share' },
        { icon: 'mdi-github', id: 'github' }
    ];
    export let subSettingsOptions: string = null;
    export let searchable: boolean = null;
    export let options: any[] = null;
    if (!options && subSettingsOptions) {
        options = getSubSettings(subSettingsOptions);
    }

    let refresh: (force?: boolean, filter?: string) => void;
    // search only makes sense on the root page: a sub page is a handful of rows already
    $: searchEnabled = searchable ?? (!subSettingsOptions && !options);

    const customLayers = getMapContext().mapModule('customLayers');
    let geoHandler: GeoHandler;
    onServiceLoaded((handler: GeoHandler) => {
        geoHandler = handler;
        refresh?.();
    });

    /**
     * The units live in a single json setting rather than one key each, so they get a store shim: the
     * settings page only ever calls `set`/`reset` on it, and `variables.ts` reloads them from the
     * `units` key change.
     */
    function unitStore(key: string) {
        function save() {
            ApplicationSettings.setString(SETTINGS_UNITS, JSON.stringify(unitsSettings));
        }
        return {
            set(value) {
                unitsSettings[key] = value;
                save();
            },
            reset() {
                delete unitsSettings[key];
                save();
            }
        };
    }

    function getSubSettings(id: string): any[] {
        switch (id) {
            case 'appearance':
                return [
                    {
                        id: 'theme',
                        description: () => getThemeDisplayName(),
                        title: lc('theme.title')
                    },
                    {
                        id: 'color_theme',
                        description: () => getColorThemeDisplayName(),
                        title: lc('color_theme.title')
                    },
                    {
                        type: 'switch',
                        key: 'auto_black',
                        title: lc('auto_black'),
                        value: ApplicationSettings.getBoolean('auto_black', false)
                    },
                    {
                        type: 'switch',
                        key: 'clock_24',
                        value: clock_24,
                        title: lc('hours_24_clock')
                    }
                ];
            case 'units':
                return [
                    {
                        type: 'switch',
                        id: SETTINGS_IMPERIAL,
                        title: lc('imperial_units'),
                        description: lc('imperial_units_desc'),
                        value: $imperial
                    },
                    {
                        type: 'sectionheader',
                        title: lc('custom_units')
                    },
                    {
                        id: 'setting',
                        store: unitStore(UNIT_FAMILIES.Distance),
                        key: UNIT_FAMILIES.Distance,
                        valueType: 'string',
                        title: lc('distance'),
                        currentValue: () => unitsSettings[UNIT_FAMILIES.Distance],
                        rightValue: () => unitsSettings[UNIT_FAMILIES.Distance],
                        values: [UNITS.Kilometers, UNITS.Miles, UNITS.Meters, UNITS.Feet, UNITS.Inch].map((unit) => ({ title: unit, value: unit }))
                    },
                    {
                        id: 'setting',
                        store: unitStore(UNIT_FAMILIES.Speed),
                        key: UNIT_FAMILIES.Speed,
                        valueType: 'string',
                        title: lc('speed'),
                        currentValue: () => unitsSettings[UNIT_FAMILIES.Speed],
                        rightValue: () => unitsSettings[UNIT_FAMILIES.Speed],
                        values: [UNITS.SpeedKm, UNITS.SpeedM, UNITS.MPH, UNITS.FPH, UNITS.Knot].map((unit) => ({ title: unit, value: unit }))
                    }
                ];
            case 'behavior':
                return [
                    {
                        type: 'switch',
                        key: 'url_use_inapp_browser',
                        value: ApplicationSettings.getBoolean('url_use_inapp_browser', true),
                        title: lc('url_use_inapp_browser')
                    }
                ].concat(
                    __ANDROID__
                        ? ([
                              {
                                  type: 'switch',
                                  key: 'list_longpress_camera',
                                  value: ApplicationSettings.getBoolean('list_longpress_camera', false),
                                  title: lc('longpress_list_open_camera')
                              },
                              {
                                  type: 'switch',
                                  key: 'immersive',
                                  store: immersive,
                                  value: $immersive,
                                  title: lc('immersive_mode')
                              }
                          ] as any)
                        : []
                );
            case 'address':
                return [
                    {
                        type: 'switch',
                        key: 'useOfflineGeocodeAddress',
                        store: useOfflineGeocodeAddress,
                        value: $useOfflineGeocodeAddress,
                        title: lc('use_offline_geocoding_address')
                    },
                    {
                        type: 'switch',
                        key: 'useSystemGeocodeAddress',
                        store: useSystemGeocodeAddress,
                        value: $useSystemGeocodeAddress,
                        title: lc('use_system_geocoding_address')
                    }
                ];
            case 'directions':
                return [
                    {
                        type: 'switch',
                        key: 'startDirDest',
                        value: ApplicationSettings.getBoolean('startDirDest', false),
                        title: lc('start_direction_dest')
                    },
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('valhalla_online_url'),
                        description: () => ApplicationSettings.getString(SETTINGS_VALHALLA_ONLINE_URL, DEFAULT_VALHALLA_ONLINE_URL),
                        currentValue: () => ApplicationSettings.getString(SETTINGS_VALHALLA_ONLINE_URL, DEFAULT_VALHALLA_ONLINE_URL),
                        onUpdate: (key, value) => packageService.setOnlineRoutingUrl(ApplicationSettings.getString(SETTINGS_VALHALLA_ONLINE_URL, DEFAULT_VALHALLA_ONLINE_URL)),
                        key: SETTINGS_VALHALLA_ONLINE_URL,
                        valueType: 'string',
                        textFieldProperties: {
                            keyboardType: 'url',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties
                    },
                    {
                        id: 'setting',
                        type: 'slider',
                        title: lc('location_distance_from_route'),
                        description: lc('location_distance_from_route_desc'),
                        key: 'location_distance_from_route',
                        default: 15,
                        min: 5,
                        max: 100,
                        step: 5,
                        formatter: formatDistance,
                        valueFormatter: formatDistance,
                        currentValue: () => ApplicationSettings.getNumber('location_distance_from_route', 15),
                        rightValue: () => formatDistance(ApplicationSettings.getNumber('location_distance_from_route', 15))
                    }
                ];
            case 'navigation':
                return getNavigationSettingsOptions();
            case 'valhalla':
                return [
                    {
                        key: SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN,
                        title: lc('offline_routing_pedestrian_max_distance'),
                        default: DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN,
                        min: 10000,
                        max: 500000,
                        step: 10000
                    },
                    {
                        key: SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE,
                        title: lc('offline_routing_bicycle_max_distance'),
                        default: DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE,
                        min: 10000,
                        max: 1000000,
                        step: 10000
                    },
                    {
                        key: SETTINGS_VALHALLA_MAX_DISTANCE_AUTO,
                        title: lc('offline_routing_auto_max_distance'),
                        default: DEFAULT_VALHALLA_MAX_DISTANCE_AUTO,
                        min: 100000,
                        max: 10000000,
                        step: 100000
                    },
                    {
                        key: SETTINGS_VALHALLA_MAX_DISTANCE_TRACE,
                        title: lc('offline_routing_trace_max_distance'),
                        default: DEFAULT_VALHALLA_MAX_DISTANCE_AUTO,
                        min: 100000,
                        max: 10000000,
                        step: 100000
                    }
                ].map((setting) => ({
                    ...setting,
                    id: 'setting',
                    type: 'slider',
                    formatter: formatDistance,
                    valueFormatter: formatDistance,
                    onUpdate: (key, value) => packageService.setValhallaSetting(setting.key, setting.default),
                    currentValue: () => ApplicationSettings.getNumber(setting.key, setting.default),
                    rightValue: () => formatDistance(ApplicationSettings.getNumber(setting.key, setting.default))
                }));
            case 'elevation_profile':
                return [
                    {
                        key: 'chart_max_filter',
                        title: lc('chart_max_filter'),
                        default: 50,
                        min: 0,
                        max: 500,
                        step: 10
                    },
                    {
                        key: 'chart_elevation_min_range',
                        title: lc('chart_elevation_min_range'),
                        default: 250,
                        min: 50,
                        max: 2000,
                        step: 50,
                        formatter: formatDistance
                    },
                    {
                        key: 'elevation_profile_smooth_window',
                        title: lc('elevation_profile_smooth_window'),
                        default: 3,
                        min: 0,
                        max: 20,
                        step: 1
                    },
                    {
                        key: 'elevation_profile_filter_step',
                        title: lc('elevation_profile_filter_step'),
                        default: 10,
                        min: 1,
                        max: 50,
                        step: 1
                    }
                ].map((setting) => ({
                    ...setting,
                    id: 'setting',
                    type: 'slider',
                    valueFormatter: setting.formatter,
                    currentValue: () => ApplicationSettings.getNumber(setting.key, setting.default),
                    rightValue: () => {
                        const value = ApplicationSettings.getNumber(setting.key, setting.default);
                        return setting.formatter ? setting.formatter(value) : value + '';
                    }
                }));
            case 'map_data':
                return (
                    dataPathsAvailable
                        ? [
                              {
                                  id: 'data_path',
                                  title: lc('map_data_path'),
                                  description: getSavedMBTilesDir
                              },
                              {
                                  id: 'items_data_path',
                                  title: lc('items_data_path'),
                                  description: getItemsDataFolder
                              }
                          ]
                        : ([] as any[])
                ).concat([
                    {
                        type: 'switch',
                        key: SETTINGS_TILE_SERVER_AUTO_START,
                        value: ApplicationSettings.getBoolean(SETTINGS_TILE_SERVER_AUTO_START, DEFAULT_TILE_SERVER_AUTO_START),
                        title: lc('auto_start_tile_server')
                    },
                    {
                        id: 'setting',
                        // a port is an arbitrary number, not a range to drag through
                        type: 'prompt',
                        title: lc('tile_server_port'),
                        key: SETTINGS_TILE_SERVER_PORT,
                        default: DEFAULT_TILE_SERVER_PORT,
                        textFieldProperties: numberTextFieldProperties,
                        currentValue: () => ApplicationSettings.getNumber(SETTINGS_TILE_SERVER_PORT, DEFAULT_TILE_SERVER_PORT),
                        rightValue: () => ApplicationSettings.getNumber(SETTINGS_TILE_SERVER_PORT, DEFAULT_TILE_SERVER_PORT)
                    },
                    {
                        type: 'switch',
                        key: 'route_image_capture',
                        value: ApplicationSettings.getBoolean('route_image_capture', true),
                        title: lc('route_item_image_capture')
                    },
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('click_handler_layer_filter'),
                        description: () => $clickHandlerLayerFilter,
                        currentValue: () => $clickHandlerLayerFilter,
                        onUpdate: () => getMapContext().mapModules.customLayers.updateClickHandlerLayerFilter(),
                        key: 'clickHandlerLayerFilter',
                        store: clickHandlerLayerFilter,
                        valueType: 'string',
                        textFieldProperties: textTextFieldProperties
                    },
                    {
                        ...layerProps.getSettingsOptions('clickRadius'),
                        // the carto style parameters are not plain settings: they go through the props proxy
                        store: { set: (value) => (layerProps['clickRadius'] = value) }
                    }
                ] as any[]);
            case 'geolocation': {
                const newItems = [];
                const geoSettings = geoHandler?.getWatchSettings() ?? {};
                Object.keys(geoSettings).forEach((key) => {
                    const setting = geoSettings[key];
                    newItems.push({
                        key,
                        rightValue: setting.formatter ? () => setting.formatter(setting.value()) : setting.value,
                        currentValue: setting.value,
                        // without this a slider shows the raw number while being dragged
                        valueFormatter: setting.formatter,
                        ...setting,
                        id: 'setting'
                    });
                });
                newItems.push(
                    {
                        type: 'switch',
                        key: 'show_accuracy_marker',
                        value: ApplicationSettings.getBoolean('show_accuracy_marker', true),
                        title: lc('show_accuracy_marker')
                    },
                    {
                        type: 'switch',
                        key: 'draw_onroute_live_data',
                        value: ApplicationSettings.getBoolean('draw_onroute_live_data', false),
                        title: lc('draw_onroute_live_data')
                    }
                );
                return newItems;
            }
            case 'a9':
                return [
                    {
                        type: 'switch',
                        key: 'a9_background_location_screenrefresh',
                        value: ApplicationSettings.getBoolean('a9_background_location_screenrefresh', false),
                        title: lc('a9_refresh_screen_on_location')
                    },
                    {
                        id: 'setting',
                        type: 'slider',
                        title: lc('a9_background_location_screenrefresh_delay'),
                        key: 'a9_background_location_screenrefresh_delay',
                        default: 100,
                        min: 0,
                        max: 2000,
                        step: 50,
                        // a sub second delay, so milliseconds rather than the duration formatter
                        formatter: formatMilliseconds,
                        valueFormatter: formatMilliseconds,
                        currentValue: () => ApplicationSettings.getNumber('a9_background_location_screenrefresh_delay', 100),
                        rightValue: () => formatMilliseconds(ApplicationSettings.getNumber('a9_background_location_screenrefresh_delay', 100))
                    }
                ];
            case 'api_keys':
                return Object.keys(customLayers.tokenKeys).map((token) => ({
                    id: 'token',
                    token,
                    value: customLayers.tokenKeys[token]
                }));
            case 'debugging':
                return PLAY_STORE_BUILD
                    ? [
                          {
                              type: 'switch',
                              id: SETTINGS_ENABLE_CRASH_REPORT,
                              title: lc('crash_report'),
                              description: lc('crash_report_desc'),
                              value: ApplicationSettings.getBoolean(SETTINGS_ENABLE_CRASH_REPORT, PLAY_STORE_BUILD)
                          }
                      ]
                    : [];
            default:
                break;
        }
        return null;
    }

    function getAvailableOptions() {
        return (
            options ||
            (
                [
                    {
                        type: 'header',
                        title: lc('donate')
                    },
                    {
                        type: 'sectionheader',
                        title: lc('general')
                    },
                    {
                        id: 'language',
                        icon: 'mdi-translate',
                        description: () => getLocaleDisplayName(),
                        title: lc('language')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-palette',
                        title: lc('appearance'),
                        description: lc('appearance_settings'),
                        options: () => getSubSettings('appearance')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-ruler',
                        title: lc('units'),
                        description: lc('units_settings'),
                        options: () => getSubSettings('units')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-cards-outline',
                        title: lc('behavior'),
                        description: lc('behavior_settings'),
                        options: () => getSubSettings('behavior')
                    },
                    {
                        type: 'sectionheader',
                        title: lc('map')
                    },
                    {
                        id: 'map_language',
                        icon: 'mdi-translate-variant',
                        description: () => getLocaleDisplayName(ApplicationSettings.getString('map_language')),
                        title: lc('map_language')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-database',
                        title: lc('map_data'),
                        description: lc('map_data_settings'),
                        options: () => getSubSettings('map_data')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-map-marker',
                        title: lc('address'),
                        description: lc('address_settings'),
                        options: () => getSubSettings('address')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-key',
                        title: lc('api_keys'),
                        description: lc('api_keys_settings'),
                        options: () => getSubSettings('api_keys')
                    },
                    {
                        type: 'sectionheader',
                        title: lc('routing')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-directions',
                        title: lc('directions'),
                        description: lc('directions_settings'),
                        options: () => getSubSettings('directions')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-navigation',
                        title: lc('navigation'),
                        description: lc('navigation_settings'),
                        options: () => getSubSettings('navigation')
                    }
                ] as any[]
            )
                .concat(
                    packageService.offlineRoutingSearchService
                        ? [
                              {
                                  id: 'sub_settings',
                                  icon: 'mdi-routes',
                                  title: lc('offline_routing'),
                                  description: lc('offline_routing_settings'),
                                  options: () => getSubSettings('valhalla')
                              }
                          ]
                        : []
                )
                .concat([
                    {
                        id: 'sub_settings',
                        icon: 'mdi-chart-bar',
                        title: lc('elevation_profile'),
                        description: lc('elevation_profile_settings'),
                        options: () => getSubSettings('elevation_profile')
                    },
                    {
                        type: 'sectionheader',
                        title: lc('location')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-crosshairs-gps',
                        title: lc('geolocation'),
                        description: lc('geolocation_settings'),
                        options: () => getSubSettings('geolocation')
                    }
                ])
                .concat(
                    isA9Watch
                        ? [
                              {
                                  id: 'sub_settings',
                                  icon: 'mdi-watch',
                                  title: lc('a9_settings'),
                                  description: lc('a9_settings_desc'),
                                  options: () => getSubSettings('a9')
                              }
                          ]
                        : []
                )
                .concat([
                    {
                        type: 'sectionheader',
                        title: lc('advanced')
                    }
                ])
                .concat(
                    PLAY_STORE_BUILD
                        ? [
                              {
                                  id: 'sub_settings',
                                  icon: 'mdi-bug-outline',
                                  title: lc('debugging'),
                                  description: lc('debugging_settings_desc'),
                                  options: () => getSubSettings('debugging')
                              }
                          ]
                        : []
                )
                .concat([
                    {
                        id: 'third_party',
                        title: lc('third_parties'),
                        description: lc('list_used_third_parties')
                    },
                    {
                        id: 'feedback',
                        title: lc('send_feedback')
                    }
                ])
                .concat(
                    PLAY_STORE_BUILD
                        ? [
                              {
                                  id: 'review',
                                  title: lc('review_application')
                              }
                          ]
                        : []
                )
                .concat([
                    {
                        type: 'sectionheader',
                        title: lc('backup_restore')
                    },
                    {
                        id: 'export_settings',
                        title: lc('export_settings'),
                        description: lc('export_settings_desc')
                    },
                    {
                        id: 'import_settings',
                        title: lc('import_settings'),
                        description: lc('import_settings_desc')
                    }
                ])
        );
    }

    function getTitle(item) {
        switch (item.id) {
            case 'token':
                return lc(item.token);
            default:
                return item.title;
        }
    }
    function getDescription(item) {
        switch (item.id) {
            case 'token':
                return item.value || lc('click_to_set_key');
            default:
                return typeof item.description === 'function' ? item.description(item) : item.description;
        }
    }
    function updateItem(item, key = 'key') {
        settingsPage?.updateItem?.(item, key);
    }

    let nbDevModeTap = 0;
    let devModeClearTimer;
    function onTouch(event) {
        if (event.action !== 'down') {
            return;
        }
        nbDevModeTap += 1;
        if (devModeClearTimer) {
            clearTimeout(devModeClearTimer);
        }
        if (nbDevModeTap === 6) {
            const devMode = (customLayers.devMode = !customLayers.devMode);
            nbDevModeTap = 0;
            showSnack({ message: devMode ? 'devmode on' : 'devmode off' });
            refresh?.();
            return;
        }
        devModeClearTimer = setTimeout(() => {
            devModeClearTimer = null;
            nbDevModeTap = 0;
        }, 500);
    }

    async function onLongPress(item, event) {
        try {
            switch (item.id) {
                case 'items_data_path': {
                    let result = await confirm({
                        message: lc('reset_setting', item.title),
                        okButtonText: lc('ok'),
                        cancelButtonText: lc('cancel')
                    });
                    if (!result) {
                        return;
                    }
                    const current = getItemsDataFolder();
                    const resultPath = resetItemsDataFolder();
                    if (resultPath && resultPath !== current) {
                        item.description = resultPath;
                        updateItem(item, 'id');

                        result = await confirm({
                            message: lc('move_items_data_files', current, resultPath),
                            okButtonText: lc('ok'),
                            cancelButtonText: lc('cancel')
                        });
                        if (result) {
                            //we need to move files around
                            Folder.fromPath(current)
                                .getEntitiesSync()
                                .forEach((entity) => {
                                    if (entity.name === 'db' || entity.name === 'item_images') {
                                        moveFileOrFolder(entity.path, path.join(resultPath, entity.name));
                                    }
                                });
                        }
                        confirmRestartApp();
                    }
                    break;
                }
            }
        } catch (error) {
            showError(error);
        }
    }

    async function onTap(item, event) {
        try {
            switch (item.id) {
                case 'export_settings': {
                    if (__ANDROID__ && SDK_VERSION < 29) {
                        const permRes = await request('storage');
                        if (!isPermResultAuthorized(permRes)) {
                            throw new Error(lc('missing_storage_perm_settings'));
                        }
                    }
                    const jsonStr = ApplicationSettings.getAllJSON();
                    DEV_LOG && console.log('export_settings', jsonStr);
                    if (jsonStr) {
                        await saveFile({
                            name: `${__APP_ID__}_settings_${dayjs().format('YYYY-MM-DD')}.json`,
                            data: jsonStr
                        });
                    }
                    break;
                }
                case 'import_settings': {
                    const result = await openFilePicker({
                        extensions: ['json'],

                        multipleSelection: false,
                        pickerMode: 0,
                        forceSAF: true
                    });
                    const filePath = result.files[0];
                    DEV_LOG && console.log('import_settings from file picker', filePath, File.exists(filePath));
                    if (filePath && File.exists(filePath)) {
                        showLoading();
                        const text = await File.fromPath(filePath).readText();
                        DEV_LOG && console.log('import_settings', text);
                        const json = JSON.parse(text);
                        const nativePref = ApplicationSettings.getNative();
                        if (__ANDROID__) {
                            const editor = (nativePref as android.content.SharedPreferences).edit();
                            editor.clear();
                            Object.keys(json).forEach((k) => {
                                if (k.startsWith('_')) {
                                    return;
                                }
                                const value = json[k];
                                const type = typeof value;
                                switch (type) {
                                    case 'boolean':
                                        editor.putBoolean(k, value);
                                        break;
                                    case 'number':
                                        editor.putLong(k, java.lang.Double.doubleToRawLongBits(double(value)));
                                        break;
                                    case 'string':
                                        editor.putString(k, value);
                                        break;
                                }
                            });
                            editor.apply();
                        } else {
                            const userDefaults = nativePref as NSUserDefaults;
                            const domain = NSBundle.mainBundle.bundleIdentifier;
                            userDefaults.removePersistentDomainForName(domain);
                            Object.keys(json).forEach((k) => {
                                if (k.startsWith('_')) {
                                    return;
                                }
                                const value = json[k];
                                const type = typeof value;
                                switch (type) {
                                    case 'boolean':
                                        userDefaults.setBoolForKey(value, k);
                                        break;
                                    case 'number':
                                        userDefaults.setDoubleForKey(value, k);
                                        break;
                                    case 'string':
                                        userDefaults.setObjectForKey(value, k);
                                        break;
                                }
                            });
                        }
                        await hideLoading();
                        confirmRestartApp();
                    }
                    break;
                }
                case 'share':
                    await share({
                        message: GIT_URL
                    });
                    break;
                case 'github':
                    openLink(GIT_URL);
                    break;
                case 'sponsor':
                    switch (item.type) {
                        case 'librepay':
                            openLink('https://liberapay.com/farfromrefuge');
                            break;
                        case 'patreon':
                            openLink('https://patreon.com/farfromrefuge');
                            break;

                        default:
                            if (__IOS__ && PLAY_STORE_BUILD) {
                                presentInAppSponsorBottomsheet();
                            } else {
                                // Apple wants us to use in-app purchase for donations => taking 30% ...
                                // so lets just open github and ask for love...
                                openLink(__IOS__ ? GIT_URL : SPONSOR_URL);
                            }
                            break;
                    }
                    break;
                case 'review':
                    openLink(STORE_REVIEW_LINK);
                    break;
                case 'language':
                    await selectLanguage();
                    break;
                case 'map_language':
                    await selectMapLanguage();
                    break;
                case 'theme':
                    await selectTheme();
                    break;
                case 'color_theme':
                    await selectColorTheme();
                    break;
                case 'feedback': {
                    if (SENTRY_ENABLED) {
                        const view = createView(ScrollView);
                        const stackLayout = createView(StackLayout, {
                            padding: 10
                        });
                        const commentsTF = createView(TextView, {
                            hint: lc('comments'),
                            variant: 'outline',
                            height: 150,
                            returnKeyType: 'done'
                        });
                        const emailTF = createView(TextField, {
                            hint: lc('email'),
                            variant: 'outline',
                            autocapitalizationType: 'none',
                            autocorrect: false,
                            keyboardType: 'email',
                            returnKeyType: 'next'
                        });
                        const nameTF = createView(TextField, {
                            hint: lc('name'),
                            variant: 'outline',
                            returnKeyType: 'next'
                        });
                        stackLayout.addChild(nameTF);
                        stackLayout.addChild(emailTF);
                        stackLayout.addChild(commentsTF);
                        view.content = stackLayout;
                        const result = await confirm({
                            title: lc('send_feedback'),
                            okButtonText: l('send'),
                            cancelButtonText: l('cancel'),
                            view
                        });
                        if (result && nameTF.text?.length && commentsTF.text?.length) {
                            const eventId = Sentry.captureMessage('User Feedback');

                            Sentry.captureUserFeedback({
                                event_id: eventId,
                                name: nameTF.text,
                                email: emailTF.text,
                                comments: commentsTF.text
                            });
                            Sentry.flush();
                            showSnack({ message: l('feedback_sent') });
                        }
                    } else {
                        openLink(GIT_URL + '/issues');
                    }
                    break;
                }
                case 'third_party': {
                    const ThirdPartySoftwareBottomSheet = (await import('~/components/settings/ThirdPartySoftwareBottomSheet.svelte')).default;
                    showBottomSheet({
                        view: ThirdPartySoftwareBottomSheet
                    });
                    break;
                }
                case 'data_path': {
                    const result = await pickFolder({
                        permissions: {
                            read: true,
                            persistable: true
                        }
                    });
                    const resultPath = result.folders[0];
                    if (resultPath) {
                        const toUsePath = getAndroidRealPath(resultPath);
                        if (toUsePath !== getSavedMBTilesDir()) {
                            setSavedMBTilesDir(toUsePath);
                            updateItem(item, 'id');
                            confirmRestartApp();
                        }
                    }
                    break;
                }
                case 'items_data_path': {
                    const result = await pickFolder({
                        permissions: {
                            read: true,
                            write: true,
                            recursive: true,
                            persistable: true
                        }
                    });
                    const resultPath = result.folders[0];
                    if (resultPath) {
                        const toUsePath = getAndroidRealPath(resultPath);
                        const current = getItemsDataFolder();
                        if (toUsePath !== current) {
                            setItemsDataFolder(toUsePath);
                            item.description = toUsePath;
                            updateItem(item, 'id');

                            const confirmed = await confirm({
                                message: lc('move_items_data_files', current, toUsePath),
                                okButtonText: lc('ok'),
                                cancelButtonText: lc('cancel')
                            });
                            if (confirmed) {
                                //we need to move files around
                                Folder.fromPath(current)
                                    .getEntitiesSync()
                                    .forEach((entity) => {
                                        if (entity.name === 'db' || entity.name === 'item_images') {
                                            moveFileOrFolder(entity.path, path.join(toUsePath, entity.name), resultPath + '/' + entity.name);
                                        }
                                    });
                            }
                            alert({
                                title: lc('setting_update'),
                                message: lc('please_restart_app')
                            });
                        }
                    }
                    break;
                }
                case 'token': {
                    const result = await prompt({
                        title: lc('token_key', lc(item.token)),
                        okButtonText: l('save'),
                        cancelButtonText: l('cancel'),
                        autoFocus: true,
                        defaultText: item.value
                    });
                    Utils.dismissSoftInput();
                    if (result && !!result.result && result.text.length > 0) {
                        customLayers.saveToken(item.token, result.text);
                        item.value = result.text;
                        updateItem(item, 'token');
                    }
                    break;
                }
            }
        } catch (err) {
            showError(err);
        } finally {
            hideLoading();
        }
    }

    async function onCheckBox(item, event) {
        switch (item.id) {
            case SETTINGS_ENABLE_CRASH_REPORT:
                ApplicationSettings.setBoolean(item.key || item.id, event.value);
                if (event.value) {
                    startSentry();
                } else {
                    stopSentry();
                }
                return true;
            default:
                return false; // BaseSettingsPage persists it, through the item store when there is one
        }
    }

    onMapLanguageChanged(() => refresh?.());
    $: refresh?.();
</script>

<BaseSettingsPage
    bind:this={settingsPage}
    {id}
    {getDescription}
    {getTitle}
    {onCheckBox}
    onItemLongPress={onLongPress}
    onItemTap={onTap}
    optionsProvider={getAvailableOptions}
    {searchEnabled}
    title={title || $slc('settings')}
    bind:refresh>
    <svelte:fragment slot="actionBarButtons">
        {#each actionBarButtons as button (button.id)}
            <mdbutton class="actionBarButton" text={button.icon} variant="text" on:tap={(event) => onTap({ id: button.id }, event)} />
        {/each}
    </svelte:fragment>

    <Template key="header" let:item>
        <gridlayout rows="auto,auto">
            <gridlayout columns="*,auto,auto" margin="10 16 0 16">
                <stacklayout
                    backgroundColor="#ea4bae"
                    borderRadius={10}
                    orientation="horizontal"
                    padding={10}
                    rippleColor="white"
                    verticalAlignment="center"
                    on:tap={(event) => onTap({ id: 'sponsor' }, event)}>
                    <label color="white" fontFamily={$fonts.mdi} fontSize={26} marginRight={10} text="mdi-heart" verticalAlignment="center" />
                    <label color="white" fontSize={12} text={item.title} textWrap={true} verticalAlignment="center" />
                </stacklayout>
                {#if __ANDROID__}
                    <image
                        borderRadius={6}
                        col={1}
                        height={40}
                        margin="0 10 0 10"
                        rippleColor="white"
                        src="~/assets/images/librepay.png"
                        verticalAlignment="center"
                        on:tap={(event) => onTap({ id: 'sponsor', type: 'librepay' }, event)} />
                    <image borderRadius={6} col={2} height={40} rippleColor="#f96754" src="~/assets/images/patreon.png" on:tap={(event) => onTap({ id: 'sponsor', type: 'patreon' }, event)} />
                {/if}
            </gridlayout>

            <gridlayout marginTop={20} paddingLeft={16} paddingRight={16} row={1} rows="auto,auto" verticalAlignment="center">
                <image borderRadius={25} col={1} height={50} horizontalAlignment="center" src="res://icon" width={50} />
                <label fontSize={13} horizontalAlignment="center" marginTop={4} row={1} text={version} on:touch={onTouch} />
            </gridlayout>
        </gridlayout>
    </Template>
</BaseSettingsPage>
