  <script context="module" lang="ts">
    import { share } from '@akylas/nativescript-app-utils/share';
    import { isPermResultAuthorized, request } from '@nativescript-community/perms';
    import { SDK_VERSION } from '@nativescript-community/sentry';
    import { CheckBox } from '@nativescript-community/ui-checkbox';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { openFilePicker, pickFolder, saveFile } from '@nativescript-community/ui-document-picker';
    import { Label } from '@nativescript-community/ui-label';
    import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { alert, confirm, prompt } from '@nativescript-community/ui-material-dialogs';
    import { TextField, TextFieldProperties } from '@nativescript-community/ui-material-textfield';
    import { TextView } from '@nativescript-community/ui-material-textview';
    import { ApplicationSettings, Device, File, Folder, ObservableArray, ScrollView, StackLayout, Utils, View, path } from '@nativescript/core';
    import { inappItems, presentInAppSponsorBottomsheet } from '@shared/utils/inapp-purchase';
    import { Sentry } from '@shared/utils/sentry';
    import { showError } from '@shared/utils/showError';
    import dayjs from 'dayjs';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { Writable, get } from 'svelte/store';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { clock_24, getLocaleDisplayName, l, lc, onLanguageChanged, onMapLanguageChanged, selectLanguage, selectMapLanguage, slc } from '~/helpers/locale';
    import { getColorThemeDisplayName, getThemeDisplayName, onThemeChanged, selectColorTheme, selectTheme } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { packageService } from '~/services/PackageService';
    import { useOfflineGeocodeAddress, useSystemGeocodeAddress } from '~/stores/mapStore';
    import {
        ALERT_OPTION_MAX_HEIGHT,
        DEFAULT_NAVIGATION_POSITION_OFFSET,
        DEFAULT_NAVIGATION_TILT,
        DEFAULT_TILE_SERVER_AUTO_START,
        DEFAULT_TILE_SERVER_PORT,
        DEFAULT_VALHALLA_MAX_DISTANCE_AUTO,
        DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE,
        DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN,
        DEFAULT_VALHALLA_ONLINE_URL,
        SETTINGS_NAVIGATION_POSITION_OFFSET,
        SETTINGS_NAVIGATION_TILT,
        SETTINGS_TILE_SERVER_AUTO_START,
        SETTINGS_TILE_SERVER_PORT,
        SETTINGS_VALHALLA_MAX_DISTANCE_AUTO,
        SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE,
        SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN,
        SETTINGS_VALHALLA_ONLINE_URL
    } from '~/utils/constants';
    import { showSnack } from '~/utils/ui';
    import { confirmRestartApp, createView, hideLoading, openLink, showAlertOptionSelect, showLoading, showSettings, showSliderPopover } from '~/utils/ui/index.common';
    import { ANDROID_30, getAndroidRealPath, getItemsDataFolder, getSavedMBTilesDir, moveFileOrFolder, resetItemsDataFolder, setItemsDataFolder, setSavedMBTilesDir } from '~/utils/utils';
    import { colors, fonts, windowInset } from '~/variables';
    import CActionBar from '../common/CActionBar.svelte';
    import ListItemAutoSize from '../common/ListItemAutoSize.svelte';

    const version = __APP_VERSION__ + ' Build ' + __APP_BUILD_NUMBER__;
</script>

<script lang="ts">
    let { colorOnBackground, colorOnSurfaceVariant } = $colors;
    $: ({ colorOnBackground, colorOnSurfaceVariant } = $colors);
    $: ({ bottom: windowInsetBottom } = $windowInset);

    let collectionView: NativeViewElementNode<CollectionView>;

    const inAppAvailable = PLAY_STORE_BUILD && inappItems?.length > 0;

    export let title = null;
    export let actionBarButtons = [
        { icon: 'mdi-share-variant', id: 'share' },
        { icon: 'mdi-github', id: 'github' }
    ];

    export let subSettingsOptions: string = null;
    export let options: any[] = null;
    if (!options && subSettingsOptions) {
        options = getSubSettings(subSettingsOptions);
    }

    let items: ObservableArray<any>;
    const customLayers = getMapContext().mapModule('customLayers');
    let geoHandler: GeoHandler;
    onServiceLoaded((handler: GeoHandler) => {
        geoHandler = handler;
        refresh();
    });

    function getSubSettings(id: string): any[] {
        switch (id) {
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
                        onUpdate: (key, value, defaultValue) => packageService.setOnlineRoutingUrl(value),
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
                        key: SETTINGS_NAVIGATION_TILT,
                        min: 0,
                        max: 90,
                        step: 1,
                        title: lc('navigation_tilt'),
                        type: 'slider',
                        rightValue: () => ApplicationSettings.getNumber(SETTINGS_NAVIGATION_TILT, DEFAULT_NAVIGATION_TILT)
                    },
                    {
                        id: 'setting',
                        key: 'route_click_radius',
                        min: 5,
                        max: 400,
                        step: 1,
                        title: lc('route_click_radius'),
                        type: 'slider',
                        rightValue: () => ApplicationSettings.getNumber('route_click_radius', 16)
                    },
                    {
                        id: 'setting',
                        key: SETTINGS_NAVIGATION_POSITION_OFFSET,
                        min: 0,
                        max: 0.5,
                        step: 0.01,
                        title: lc('navigation_position_offset'),
                        type: 'slider',
                        rightValue: () => ApplicationSettings.getNumber(SETTINGS_NAVIGATION_POSITION_OFFSET, DEFAULT_NAVIGATION_POSITION_OFFSET)
                    },
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('offline_routing_pedestrian_max_distance'),
                        key: 'location_distance_from_route',
                        valueType: 'number',
                        default: 15,
                        textFieldProperties: {
                            keyboardType: 'number',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties,
                        rightValue: () => ApplicationSettings.getNumber('location_distance_from_route', 15)
                    },
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('elevation_profile_smooth_window'),
                        key: 'elevation_profile_smooth_window',
                        valueType: 'number',
                        default: 3,
                        textFieldProperties: {
                            keyboardType: 'number',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties,
                        rightValue: () => ApplicationSettings.getNumber('elevation_profile_smooth_window', 3)
                    },
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('elevation_profile_filter_step'),
                        key: 'elevation_profile_filter_step',
                        valueType: 'number',
                        default: 10,
                        textFieldProperties: {
                            keyboardType: 'number',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties,
                        rightValue: () => ApplicationSettings.getNumber('elevation_profile_filter_step', 10)
                    }
                ];
            case 'general':
                return [
                    {
                        
                        type: 'switch',
                        key: 'list_longpress_camera',
                        value: ApplicationSettings.getBoolean('list_longpress_camera', false),
                        title: lc('longpress_list_open_camera')
                    }
                ];
            case 'address':
                return [
                    {
                        type: 'switch',
                        mapStore: useOfflineGeocodeAddress,
                        value: get(useOfflineGeocodeAddress),
                        title: lc('use_offline_geocoding_address')
                    },
                    {
                        type: 'switch',
                        mapStore: useSystemGeocodeAddress,
                        value: get(useSystemGeocodeAddress),
                        title: lc('use_system_geocoding_address')
                    }
                ];
            case 'valhalla':
                return [
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('offline_routing_pedestrian_max_distance'),
                        key: SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN,
                        valueType: 'number',
                        textFieldProperties: {
                            keyboardType: 'number',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties,
                        onUpdate: (key, value, defaultValue) => packageService.setValhallaSetting(key, defaultValue),
                        rightValue: () => ApplicationSettings.getNumber(SETTINGS_VALHALLA_MAX_DISTANCE_PEDESTRIAN, DEFAULT_VALHALLA_MAX_DISTANCE_PEDESTRIAN)
                    },
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('offline_routing_bicycle_max_distance'),
                        key: SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE,
                        valueType: 'number',
                        textFieldProperties: {
                            keyboardType: 'number',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties,
                        onUpdate: (key, value, defaultValue) => packageService.setValhallaSetting(key, defaultValue),
                        rightValue: () => ApplicationSettings.getNumber(SETTINGS_VALHALLA_MAX_DISTANCE_BICYCLE, DEFAULT_VALHALLA_MAX_DISTANCE_BICYCLE)
                    },
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('offline_routing_auto_max_distance'),
                        key: SETTINGS_VALHALLA_MAX_DISTANCE_AUTO,
                        valueType: 'number',
                        textFieldProperties: {
                            keyboardType: 'number',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties,
                        onUpdate: (key, value, defaultValue) => packageService.setValhallaSetting(key, defaultValue),
                        rightValue: () => ApplicationSettings.getNumber(SETTINGS_VALHALLA_MAX_DISTANCE_AUTO, DEFAULT_VALHALLA_MAX_DISTANCE_AUTO)
                    }
                ];
            case 'charts':
                return [{
                        id: 'setting',
                        type: 'prompt',
                        title: lc('chart_max_filter'),
                        key: 'chart_max_filter',
                        valueType: 'number',
                        default: 50,
                        textFieldProperties: {
                            keyboardType: 'number',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties,
                        rightValue: () => ApplicationSettings.getNumber('chart_max_filter', 50)
                    }];
            case 'offline_data':
                return [
                    {
                        type: 'switch',
                        key: SETTINGS_TILE_SERVER_AUTO_START,
                        value: ApplicationSettings.getBoolean(SETTINGS_TILE_SERVER_AUTO_START, DEFAULT_TILE_SERVER_AUTO_START),
                        title: lc('auto_start_tile_server')
                    },
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('tile_server_port'),
                        key: SETTINGS_TILE_SERVER_PORT,
                        valueType: 'number',
                        default: DEFAULT_TILE_SERVER_PORT,
                        textFieldProperties: {
                            keyboardType: 'number',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties,
                        rightValue: () => ApplicationSettings.getNumber(SETTINGS_TILE_SERVER_PORT, DEFAULT_TILE_SERVER_PORT)
                    },
                    {
                        type: 'switch',
                        key: 'route_image_capture',
                        value: ApplicationSettings.getBoolean('route_image_capture', true),
                        title: lc('route_item_image_capture')
                    }
                ];
            case 'geolocation':
                const newItems = [];
                const geoSettings = geoHandler.getWatchSettings();
                Object.keys(geoSettings).forEach((k) => {
                    const value = geoSettings[k];
                    newItems.push({
                        key: k,
                        rightValue: value.formatter ? () => value.formatter(value.value()) : value.value,
                        currentValue: value.value,
                        ...value,
                        id: 'setting'
                    });
                });
                newItems.push({
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
                });
                if (__ANDROID__ && Device.model === 'HLTE556N') {
                    newItems.push({
                        type: 'switch',
                        key: 'a9_background_location_screenrefresh',
                        value: ApplicationSettings.getBoolean('a9_background_location_screenrefresh', false),
                        title: lc('a9_refresh_screen_on_location')
                    },
                    {
                        id: 'setting',
                        type: 'prompt',
                        title: lc('a9_background_location_screenrefresh_delay'),
                        key: 'a9_background_location_screenrefresh_delay',
                        valueType: 'number',
                        default: 100,
                        textFieldProperties: {
                            keyboardType: 'number',
                            autocapitalizationType: 'none',
                            autocorrect: false
                        } as TextFieldProperties,
                        rightValue: () => ApplicationSettings.getNumber('a9_background_location_screenrefresh_delay', 100)
                    });
                }
                return newItems;
            case 'api_keys':
                const tokenSettings = [
                    {
                        type: 'html',
                        description: getMapContext().mapModules.customLayers.americanaOSMHTML
                    }
                ] as any[];
                Object.keys(customLayers.tokenKeys).forEach((k) => {
                    tokenSettings.push({
                        id: 'token',
                        token: k,
                        value: customLayers.tokenKeys[k]
                    });
                });

                return tokenSettings;
            default:
                break;
        }
        return null;
    }

    let nbDevModeTap = 0;
    let devModeClearTimer;
    function onTouch(item, event) {
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
            refresh();
            return;
        }
        devModeClearTimer = setTimeout(() => {
            devModeClearTimer = null;
            nbDevModeTap = 0;
        }, 500);
    }

    function getTitle(item) {
        switch (item.id) {
            case 'token':
                return lc(item.token);
            default:
                return item.title;
        }
    }
    function getSubtitle(item) {
        switch (item.id) {
            case 'token':
                return item.value || lc('click_to_set_key');
            default:
                return typeof item.description === 'function' ? item.description() : item.description;
        }
    }
    function refresh() {
        const newItems: any[] =
            options ||
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
                    description: () => getLocaleDisplayName(),
                    title: lc('language')
                },
                {
                    id: 'map_language',
                    description: () => getLocaleDisplayName(ApplicationSettings.getString('map_language')),
                    title: lc('map_language')
                }
            ]
                .concat([
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
                        id: 'auto_black',
                        title: lc('auto_black'),
                        value: ApplicationSettings.getBoolean('auto_black', false)
                    },
                    {
                        type: 'switch',
                        key: 'clock_24',
                        value: clock_24,
                        title: lc('hours_24_clock')
                    }
                    // {
                    //     id: 'share',
                    //     rightBtnIcon: 'mdi-chevron-right',
                    //     title: lc('share_application')
                    // },
                ] as any)
                .concat(
                    __ANDROID__ && !PLAY_STORE_BUILD && ANDROID_30
                        ? [
                              {
                                  id: 'data_path',
                                  title: lc('map_data_path'),
                                  description: getSavedMBTilesDir
                                  //   rightBtnIcon: 'mdi-chevron-right'
                              },
                              {
                                  id: 'items_data_path',
                                  title: lc('items_data_path'),
                                  description: getItemsDataFolder
                                  //   rightBtnIcon: 'mdi-chevron-right'
                              }
                          ]
                        : ([] as any)
                )

                .concat(
                    PLAY_STORE_BUILD
                        ? [
                              //   {
                              //       id: 'share',
                              //       rightBtnIcon: 'mdi-chevron-right',
                              //       title: lc('share_application')
                              //   },
                              {
                                  id: 'review',
                                  //   rightBtnIcon: 'mdi-chevron-right',
                                  title: lc('review_application')
                              }
                          ]
                        : ([] as any)
                )
                .concat([
                    {
                        id: 'third_party',
                        title: lc('third_parties'),
                        description: lc('list_used_third_parties')
                    },
                    {
                        id: 'feedback',
                        icon: 'mdi-bullhorn',
                        title: lc('send_feedback')
                    },
                    {
                        id: 'sub_settings',
                        icon: 'mdi-cards-outline',
                        title: lc('behavior'),
                        description: lc('behavior_settings'),
                        options: () => getSubSettings('general')
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
                        icon: 'mdi-chart-bar',
                        title: lc('charts'),
                        description: lc('charts_settings'),
                        options: () => getSubSettings('charts')
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
                        icon: 'mdi-crosshairs-gps',
                        title: lc('geolocation'),
                        description: lc('geolocation_settings'),
                        options: () => getSubSettings('geolocation')
                    }
                ] as any)
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
                        : ([] as any)
                )
                .concat(
                    packageService.localVectorTileLayer
                        ? [
                              {
                                  id: 'sub_settings',
                                  icon: 'mdi-database',
                                  title: lc('offline_data'),
                                  description: lc('offline_data_settings'),
                                  options: () => getSubSettings('offline_data')
                              }
                          ]
                        : ([] as any)
                )
                .concat([
                    {
                        id: 'sub_settings',
                        icon: 'mdi-key',
                        title: lc('api_keys'),
                        description: lc('api_keys_settings'),
                        options: () => getSubSettings('api_keys')
                    },
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
                ] as any);

        items = new ObservableArray(newItems);
    }

    async function onLongPress(item, event) {
        try {
            switch (item.id) {
                // case 'data_path': {
                //     const result = await confirm({
                //         message: lc('reset_setting', item.title),
                //         okButtonText: lc('ok'),
                //         cancelButtonText: lc('cancel')
                //     });
                //     if (!result) {
                //         return;
                //     }
                //     setSavedMBTilesDir(null);

                //     item.description = await getDefaultMBTilesDir();
                //     updateItem(item, 'id');
                //     break;
                // }
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
    function updateItem(item, key = 'key') {
        item.onUpdate?.(key, item[key], item.default);
        const index = items.findIndex((it) => it[key] === item[key]);
        if (index !== -1) {
            items.setItem(index, item);
        }
    }
    let checkboxTapTimer;
    async function onTap(item, event) {
        try {
            if (item.type === 'checkbox' || item.type === 'switch') {
                // we dont want duplicate events so let s timeout and see if we clicking diretly on the checkbox
                const checkboxView: CheckBox = ((event.object as View).parent as View).getViewById('checkbox');
                checkboxTapTimer = setTimeout(() => {
                    checkboxView.checked = !checkboxView.checked;
                }, 10);
                return;
            }
            switch (item.id) {
                case 'sub_settings': {
                    showSettings({
                        title: item.title,
                        options: item.options(),
                        actionBarButtons: item.actionBarButtons?.() || []
                    });

                    break;
                }
                case 'export_settings':
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
                case 'import_settings':
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
                case 'review':
                    openLink(STORE_REVIEW_LINK);
                    break;
                case 'third_party':
                    const ThirdPartySoftwareBottomSheet = (await import('~/components/settings/ThirdPartySoftwareBottomSheet.svelte')).default;
                    showBottomSheet({
                        parent: this,
                        view: ThirdPartySoftwareBottomSheet
                        // trackingScrollView: 'scrollView'
                    });
                    break;
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
                            //TODO: we need to move files from current to new folder
                            // Folder.fromPath(current).getEntitiesSync().forEach(e=>{
                            //     e.
                            // })
                            item.description = toUsePath;
                            updateItem(item, 'id');

                            const result = await confirm({
                                message: lc('move_items_data_files', current, toUsePath),
                                okButtonText: lc('ok'),
                                cancelButtonText: lc('cancel')
                            });
                            if (result) {
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
                case 'setting': {
                    if (item.type === 'prompt') {
                        const result = await prompt({
                            title: getTitle(item),
                            message: getSubtitle(item),
                            okButtonText: l('save'),
                            cancelButtonText: l('cancel'),
                            autoFocus: true,
                            textFieldProperties: item.textFieldProperties,
                            defaultText: (item.currentValue || item.rightValue)?.() + '',
                            view: item.useHTML
                                ? createView(
                                      Label,
                                      {
                                          padding: '10 20 0 20',
                                          textWrap: true,
                                          color: colorOnSurfaceVariant as any,
                                          html: item.full_description || item.description
                                      },
                                      item.onLinkTap
                                          ? {
                                                linkTap: item.onLinkTap
                                            }
                                          : undefined
                                  )
                                : undefined
                        });
                        Utils.dismissSoftInput();
                        if (result && !!result.result && result.text.length > 0) {
                            if (item.valueType === 'string') {
                                ApplicationSettings.setString(item.key, result.text);
                            } else {
                                ApplicationSettings.setNumber(item.key, parseInt(result.text, 10));
                            }
                            updateItem(item);
                        }
                    } else if (item.type === 'slider') {
                        await showSliderPopover({
                            anchor: event.object,
                            value: (item.currentValue || item.rightValue)?.(),
                            ...item,
                            onChange(value) {
                                if (item.transformValue) {
                                    value = item.transformValue(value, item);
                                } else {
                                    value = Math.round(value / item.step) * item.step;
                                }
                                if (item.mapStore) {
                                    (item.mapStore as Writable<boolean>).set(value);
                                } else {
                                    if (item.valueType === 'string') {
                                        ApplicationSettings.setString(item.key, value + '');
                                    } else {
                                        ApplicationSettings.setNumber(item.key, value);
                                    }
                                }
                                updateItem(item);
                            }
                        });
                    } else {
                        const currentValue = ApplicationSettings.getNumber(item.key, item.default);
                        let selectedIndex = -1;
                        const options = item.values.map((k, index) => {
                            const selected = currentValue === k.value;
                            if (selected) {
                                selectedIndex = index;
                            }
                            return {
                                name: k.title || k.name,
                                data: k.value,
                                boxType: 'circle',
                                type: 'checkbox',
                                value: selected
                            };
                        });
                        const result = await showAlertOptionSelect(
                            {
                                height: Math.min(options.length * 56, ALERT_OPTION_MAX_HEIGHT),
                                rowHeight: 56,
                                selectedIndex,
                                options
                            },
                            {
                                title: item.title
                            }
                        );
                        if (result?.data !== undefined) {
                            ApplicationSettings.setNumber(item.key, result.data);
                            updateItem(item);
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
                }
            }
        } catch (err) {
            showError(err);
        } finally {
            hideLoading();
        }
    }

    function selectTemplate(item, index, items) {
        if (item.type === 'prompt') {
            return 'default';
        }

        if (item.icon) {
            return 'leftIcon';
        }
        return item.type || 'default';
    }

    function onCheckBox(item, event) {
        if (item.value === event.value) {
            return;
        }
        const value = event.value;
        item.value = value;
        if (checkboxTapTimer) {
            clearTimeout(checkboxTapTimer);
            checkboxTapTimer = null;
        }
        try {
            if (item.mapStore) {
                (item.mapStore as Writable<boolean>).set(value);
            } else {
                ApplicationSettings.setBoolean(item.key || item.id, value);
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    function refreshCollectionView() {
        collectionView?.nativeView.refresh();
        //     console.log('refreshCollectionView');
        // const nativeView = collectionView?.nativeView;
        //     if (nativeView) {
        //         items.forEach((item, index)=>{
        //         if (item.type === 'switch') {
        //             nativeView.getViewForItemAtIndex(index).getViewById('checkbox')?.updateTheme?.();
        //         }
        //     });
        //     }
    }
    onThemeChanged(refreshCollectionView);
    onLanguageChanged((value, event) => {
        if (event.clock_24 !== true) {
            refresh();
        }
    });
    onMapLanguageChanged(refresh);
</script>

<page actionBarHidden={true}>
    <gridlayout paddingLeft={$windowInset.left} paddingRight={$windowInset.right} rows="auto,*">
        <collectionview bind:this={collectionView} itemTemplateSelector={selectTemplate} {items} row={1} android:paddingBottom={windowInsetBottom + $windowInset.keyboard}>
            <Template key="sectionheader" let:item>
                <label class="sectionHeader" text={item.title} />
            </Template>
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

                    <gridlayout columns="*,auto,*" marginTop={20} paddingLeft={16} paddingRight={16} row={1} verticalAlignment="center">
                        <image borderRadius={25} col={1} height={50} horizontalAlignment="center" marginBottom={20} src="res://icon" width={50} />
                        <label
                            col={1}
                            fontSize={13}
                            marginTop={4}
                            text={version}
                            verticalAlignment="bottom"
                            on:longPress={(event) => onLongPress({ id: 'version' }, event)}
                            on:touch={(e) => onTouch(item, e)} />
                    </gridlayout>
                </gridlayout>
            </Template>
            <Template key="switch" let:item>
                <ListItemAutoSize fontSize={20} item={{ ...item, title: getTitle(item), subtitle: getSubtitle(item) }} leftIcon={item.icon} on:tap={(event) => onTap(item, event)}>
                    <switch id="checkbox" checked={item.value} col={1} on:checkedChange={(e) => onCheckBox(item, e)} />
                </ListItemAutoSize>
            </Template>
            <Template key="checkbox" let:item>
                <ListItemAutoSize fontSize={20} item={{ ...item, title: getTitle(item), subtitle: getSubtitle(item) }} leftIcon={item.icon} on:tap={(event) => onTap(item, event)}>
                    <checkbox id="checkbox" checked={item.value} col={1} marginLeft={10} on:checkedChange={(e) => onCheckBox(item, e)} />
                </ListItemAutoSize>
            </Template>
            <Template key="leftIcon" let:item>
                <ListItemAutoSize
                    columns="auto,*,auto"
                    fontSize={20}
                    item={{ ...item, title: getTitle(item), subtitle: getSubtitle(item) }}
                    mainCol={1}
                    showBottomLine={false}
                    on:tap={(event) => onTap(item, event)}>
                    <label col={0} color={colorOnBackground} fontFamily={$fonts.mdi} fontSize={24} padding="0 10 0 0" text={item.icon} verticalAlignment="center" />
                </ListItemAutoSize>
            </Template>
            <Template let:item>
                <ListItemAutoSize
                    fontSize={20}
                    item={{ ...item, title: getTitle(item), subtitle: getSubtitle(item) }}
                    showBottomLine={false}
                    on:tap={(event) => onTap(item, event)}
                    on:longPress={(event) => onLongPress(item, event)}>
                </ListItemAutoSize>
            </Template>
            <Template key="html" let:item>
                <ListItemAutoSize
                    fontSize={20}
                    item={{ ...item, title: getTitle(item), html: getSubtitle(item) }}
                    showBottomLine={false}
                    on:tap={(event) => onTap(item, event)}
                    on:longPress={(event) => onLongPress(item, event)}>
                </ListItemAutoSize>
            </Template>
            <!-- <Template key="switch" let:item>
                <gridlayout columns="*,auto" padding="0 10 0 10">
                    <stacklayout verticalAlignment="middle">
                        <label fontSize={17} lineBreak="end" maxLines={1} text={getTitle(item)} verticalTextAlignment="top" />
                        <label
                            color={colorOnSurfaceVariant}
                            fontSize={14}
                            lineBreak="end"
                            maxLines={2}
                            text={getSubtitle(item)}
                            verticalTextAlignment="top"
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapse'} />
                    </stacklayout>
                    <switch checked={item.value} col={1} verticalAlignment="middle" on:checkedChange={(e) => onCheckBox(item, e.value)} />
                    <absolutelayout backgroundColor={colorOutlineVariant} colSpan={2} height={1} verticalAlignment="bottom" />
                </gridlayout>
            </Template>
            <Template let:item>
                <gridlayout class="textRipple" columns="auto,*,auto" on:tap={(event) => onTap(item.id, item)} on:longPress={(event) => onLongPress(item.id, item)} on:touch={(e) => onTouch(item, e)}>
                    <label fontFamily={$fonts.mdi} fontSize={36} marginLeft="-10" text={item.icon} verticalAlignment="middle" visibility={!!item.icon ? 'visible' : 'hidden'} width={40} />
                    <stacklayout col={1} marginLeft="10" verticalAlignment="middle">
                        <label fontSize={17} lineBreak="end" maxLines={1} text={getTitle(item)} textWrap="true" verticalTextAlignment="top" />
                        <label
                            color={colorOnSurfaceVariant}
                            fontSize={14}
                            lineBreak="end"
                            maxLines={2}
                            text={getSubtitle(item)}
                            verticalTextAlignment="top"
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapse'} />
                    </stacklayout>

                    <label
                        col={2}
                        color={colorOnSurfaceVariant}
                        marginLeft={16}
                        marginRight={16}
                        text={item.rightValue && item.rightValue()}
                        verticalAlignment="middle"
                        visibility={!!item.rightValue ? 'visible' : 'collapse'} />
                    <label
                        class="mdi"
                        col={2}
                        color={colorOnSurfaceVariant}
                        fontSize={30}
                        height={25}
                        horizontalAlignment="right"
                        marginLeft={10}
                        marginRight={10}
                        text={item.rightBtnIcon}
                        visibility={!!item.rightBtnIcon ? 'visible' : 'hidden'}
                        width={25} />
                    <absolutelayout backgroundColor={colorOutlineVariant} col={1} colSpan={3} height={1} row={2} verticalAlignment="bottom" />
                </gridlayout>
            </Template> -->
        </collectionview>
        <CActionBar canGoBack title={title || $slc('settings')}>
            {#each actionBarButtons as button}
                <mdbutton class="actionBarButton" text={button.icon} variant="text" on:tap={(event) => onTap({ id: button.id }, event)} />
            {/each}
        </CActionBar>
    </gridlayout>
</page>
