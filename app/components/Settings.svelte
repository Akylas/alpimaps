<script lang="ts">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { openFilePicker, pickFolder, saveFile } from '@nativescript-community/ui-document-picker';
    import { alert, confirm, prompt } from '@nativescript-community/ui-material-dialogs';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { ApplicationSettings, File, Folder, ObservableArray, Utils, path } from '@nativescript/core';
    import dayjs from 'dayjs';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { clock_24, getLocaleDisplayName, l, lc, onLanguageChanged, onMapLanguageChanged, selectLanguage, selectMapLanguage, slc } from '~/helpers/locale';
    import { getThemeDisplayName, selectTheme } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { showError } from '~/utils/error';
    import { share } from '~/utils/share';
    import { showBottomSheet } from '~/utils/svelte/bottomsheet';
    import { hideLoading, openLink, showLoading } from '~/utils/ui';
    import { ANDROID_30, getDefaultMBTilesDir, moveFileOrFolder } from '~/utils/utils';
    import { getAndroidRealPath, getItemsDataFolder, getSavedMBTilesDir, resetItemsDataFolder, restartApp, setItemsDataFolder, setSavedMBTilesDir } from '~/utils/utils';
    import { borderColor, mdiFontFamily, navigationBarHeight, subtitleColor } from '~/variables';
    import CActionBar from './CActionBar.svelte';

    let collectionView: NativeViewElementNode<CollectionView>;

    let items: ObservableArray<any>;
    const customLayers = getMapContext().mapModule('customLayers');
    let geoHandler: GeoHandler;
    onServiceLoaded((handler: GeoHandler) => {
        geoHandler = handler;
        refresh();
    });

    let nbDevModeTap = 0;
    let devModeClearTimer;
    function onTouch(item, event) {
        if (item.id !== 'version' || event.action !== 'down') {
            return;
        }
        nbDevModeTap += 1;
        if (devModeClearTimer) {
            clearTimeout(devModeClearTimer);
        }
        if (nbDevModeTap === 6) {
            const devMode = (customLayers.devMode = !customLayers.devMode);
            nbDevModeTap = 0;
            showSnack({ message: devMode ? lc('devmode_on') : lc('devmode_off') });
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
                return item.description || '';
        }
    }
    function refresh() {
        const newItems = [
            {
                id: 'language',
                rightValue: getLocaleDisplayName,
                title: lc('language')
            },
            {
                type: 'switch',
                key: 'clock_24',
                value: clock_24,
                title: lc('hours_24_clock')
            },
            {
                id: 'dark_mode',
                rightValue: getThemeDisplayName,
                title: lc('dark_mode')
            },
            {
                type: 'switch',
                key: 'startDirDest',
                value: ApplicationSettings.getBoolean('startDirDest', false),
                title: lc('start_direction_dest')
            },
            // {
            //     id: 'share',
            //     rightBtnIcon: 'mdi-chevron-right',
            //     title: lc('share_application')
            // },
            {
                id: 'data_path',
                title: lc('map_data_path'),
                description: getSavedMBTilesDir(),
                rightBtnIcon: 'mdi-chevron-right'
            },
            {
                id: 'version',
                title: lc('version'),
                description: __APP_VERSION__ + ' Build ' + __APP_BUILD_NUMBER__
            },
            {
                id: 'github',
                rightBtnIcon: 'mdi-chevron-right',
                title: lc('source_code'),
                description: lc('get_app_source_code')
            },
            {
                id: 'third_party',
                rightBtnIcon: 'mdi-chevron-right',
                title: lc('third_parties'),
                description: lc('list_used_third_parties')
            },
            {
                id: 'export_settings',
                title: lc('export_settings'),
                description: lc('export_settings_desc'),
                rightBtnIcon: 'mdi-chevron-right'
            },
            {
                id: 'import_settings',
                title: lc('import_settings'),
                description: lc('import_settings_desc'),
                rightBtnIcon: 'mdi-chevron-right'
            }
        ];

        if (ANDROID_30) {
            newItems.push({
                id: 'items_data_path',
                title: lc('items_data_path'),
                description: getItemsDataFolder(),
                rightBtnIcon: 'mdi-chevron-right'
            });
        }
        if (customLayers.hasLocalData) {
            newItems.splice(1, 0, {
                id: 'map_language',
                rightValue: () => getLocaleDisplayName(ApplicationSettings.getString('map_language')),
                title: lc('map_language')
            });
        }
        const geoSettings = geoHandler.getWatchSettings();
        Object.keys(geoSettings).forEach((k) => {
            const value = geoSettings[k];
            newItems.push({
                key: k,
                rightValue: value.formatter ? () => value.formatter(ApplicationSettings.getNumber(k, value.default)) : undefined,
                ...value,
                id: 'setting'
            });
        });

        const tokenSettings = [];
        Object.keys(customLayers.tokenKeys).forEach((k) => {
            tokenSettings.push({
                id: 'token',
                token: k,
                value: customLayers.tokenKeys[k],
                rightBtnIcon: 'mdi-chevron-right'
            });
        });

        newItems.push(...tokenSettings);
        items = new ObservableArray(newItems);
    }

    async function onLongPress(command, item?) {
        try {
            switch (command) {
                case 'data_path': {
                    const result = await confirm({
                        message: lc('reset_setting', item.title),
                        okButtonText: lc('ok'),
                        cancelButtonText: lc('cancel')
                    });
                    if (!result) {
                        return;
                    }
                    setSavedMBTilesDir(null);

                    item.description = await getDefaultMBTilesDir();
                    updateItem(item, 'id');
                    break;
                }
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
                        alert({
                            title: lc('setting_update'),
                            message: lc('please_restart_app')
                        });
                    }
                    break;
                }
            }
        } catch (error) {
            showError(error);
        }
    }
    function updateItem(item, key = 'key') {
        const index = items.findIndex((it) => it[key] === item[key]);
        if (index !== -1) {
            items.setItem(index, item);
        }
    }
    async function onTap(command, item?) {
        try {
            switch (command) {
                case 'export_settings':
                    //@ts-ignore
                    const jsonStr = ApplicationSettings.getAllJSON();
                    console.log('jsonStr', jsonStr);
                    if (jsonStr) {
                        await saveFile({
                            name: `alpimaps_settings_${dayjs().format('YYYY-MM-DD')}.json`,
                            data: jsonStr
                        });
                    }
                    break;
                case 'import_settings':
                    const result = await openFilePicker({
                        extensions: ['application/json'],
                        multipleSelection: false,
                        pickerMode: 0
                    });
                    const filePath = result.files[0];
                    if (filePath && File.exists(filePath)) {
                        showLoading();
                        const json = JSON.parse(await File.fromPath(filePath).readText());
                        //@ts-ignore
                        const nativePref = ApplicationSettings.getNative();
                        if (__ANDROID__) {
                            const editor = (nativePref as android.content.SharedPreferences).edit();
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
                        hideLoading();
                        const result = await confirm({
                            message: lc('restart_app'),
                            okButtonText: lc('restart'),
                            cancelButtonText: lc('later')
                        });
                        if (result) {
                            restartApp();
                        }
                    }
                    break;
                case 'github':
                    openLink(GIT_URL);
                    break;
                case 'language':
                    await selectLanguage();
                    break;
                case 'map_language':
                    await selectMapLanguage();
                    break;
                case 'dark_mode':
                    await selectTheme();
                    // (collectionView.nativeView as CollectionView).refreshVisibleItems();
                    break;
                case 'share':
                    share({
                        message: STORE_LINK
                    });
                    break;
                case 'review':
                    Utils.openUrl(STORE_REVIEW_LINK);
                    break;
                case 'third_party':
                    const ThirdPartySoftwareBottomSheet = (await import('~/components/ThirdPartySoftwareBottomSheet.svelte')).default;
                    showBottomSheet({
                        parent: this,
                        view: ThirdPartySoftwareBottomSheet,
                        ignoreTopSafeArea: true,
                        trackingScrollView: 'trackingScrollView'
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
                            alert({
                                title: lc('setting_update'),
                                message: lc('please_restart_app')
                            });
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
                            okButtonText: l('save'),
                            cancelButtonText: l('cancel'),
                            autoFocus: true,
                            defaultText: ApplicationSettings.getNumber(item.key, item.default) + ''
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
                    } else {
                        const OptionSelect = (await import('~/components/OptionSelect.svelte')).default;
                        const result = await showBottomSheet<any>({
                            parent: null,
                            view: OptionSelect,
                            props: {
                                options: item.values.map((k) => ({ name: k.title, data: k.value }))
                            },
                            trackingScrollView: 'collectionView'
                        });
                        if (result) {
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
    onLanguageChanged(refresh);
    onMapLanguageChanged(refresh);

    function selectTemplate(item, index, items) {
        return item.type === 'switch' ? item.type : 'default';
    }

    function onCheckBox(item, value: boolean) {
        try {
            ApplicationSettings.setBoolean(item.key, value);
        } catch (error) {
            console.error(error, error.stack);
        }
    }
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,*">
        <collectionview bind:this={collectionView} itemTemplateSelector={selectTemplate} {items} row={1} rowHeight={70} android:paddingBottom={$navigationBarHeight}>
            <Template key="switch" let:item>
                <gridlayout columns="*,auto" padding="0 10 0 10">
                    <stacklayout verticalAlignment="middle">
                        <label fontSize={17} lineBreak="end" maxLines={1} text={getTitle(item)} verticalTextAlignment="top" />
                        <label
                            color={$subtitleColor}
                            fontSize={14}
                            lineBreak="end"
                            maxLines={2}
                            text={getSubtitle(item)}
                            verticalTextAlignment="top"
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapsed'} />
                    </stacklayout>
                    <switch checked={item.value} col={1} verticalAlignment="middle" on:checkedChange={(e) => onCheckBox(item, e.value)} />
                    <absolutelayout backgroundColor={$borderColor} colSpan={2} height={1} verticalAlignment="bottom" />
                </gridlayout>
            </Template>
            <Template let:item>
                <gridlayout class="textRipple" columns="auto,*,auto" on:tap={(event) => onTap(item.id, item)} on:longPress={(event) => onLongPress(item.id, item)} on:touch={(e) => onTouch(item, e)}>
                    <label fontFamily={mdiFontFamily} fontSize={36} marginLeft="-10" text={item.icon} verticalAlignment="middle" visibility={!!item.icon ? 'visible' : 'hidden'} width={40} />
                    <stacklayout col={1} marginLeft="10" verticalAlignment="middle">
                        <label fontSize={17} lineBreak="end" maxLines={1} text={getTitle(item)} textWrap="true" verticalTextAlignment="top" />
                        <label
                            color={$subtitleColor}
                            fontSize={14}
                            lineBreak="end"
                            maxLines={2}
                            text={getSubtitle(item)}
                            verticalTextAlignment="top"
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapsed'} />
                    </stacklayout>

                    <label
                        col={2}
                        color={$subtitleColor}
                        marginLeft={16}
                        marginRight={16}
                        text={item.rightValue && item.rightValue()}
                        verticalAlignment="middle"
                        visibility={!!item.rightValue ? 'visible' : 'collapsed'} />
                    <label
                        class="mdi"
                        col={2}
                        color={$subtitleColor}
                        fontSize={30}
                        height={25}
                        horizontalAlignment="right"
                        marginLeft={10}
                        marginRight={10}
                        text={item.rightBtnIcon}
                        visibility={!!item.rightBtnIcon ? 'visible' : 'hidden'}
                        width={25} />
                    <absolutelayout backgroundColor={$borderColor} col={1} colSpan={3} height={1} row={2} verticalAlignment="bottom" />
                </gridlayout>
            </Template>
        </collectionview>
        <CActionBar canGoBack title={$slc('settings')} />
    </gridlayout>
</page>
