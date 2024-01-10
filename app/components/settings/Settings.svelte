<script lang="ts">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { openFilePicker, pickFolder, saveFile } from '@nativescript-community/ui-document-picker';
    import { alert, confirm, prompt } from '@nativescript-community/ui-material-dialogs';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { ApplicationSettings, File, Folder, ObservableArray, Utils, View, path } from '@nativescript/core';
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
    import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { hideLoading, openLink, showLoading } from '~/utils/ui';
    import { ANDROID_30, getDefaultMBTilesDir, moveFileOrFolder } from '~/utils/utils';
    import { getAndroidRealPath, getItemsDataFolder, getSavedMBTilesDir, resetItemsDataFolder, restartApp, setItemsDataFolder, setSavedMBTilesDir } from '~/utils/utils';
    import { colors, fonts, navigationBarHeight } from '~/variables';
    import CActionBar from '../common/CActionBar.svelte';
    import ListItemAutoSize from '../common/ListItemAutoSize.svelte';
    import { CheckBox } from '@nativescript-community/ui-checkbox';
    $: ({ colorOnSurfaceVariant, colorOutlineVariant } = $colors);

    const version = __APP_VERSION__ + ' Build ' + __APP_BUILD_NUMBER__;

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
                return typeof item.description === 'function' ? item.description() : item.description;
        }
    }
    function refresh() {
        const newItems = [
            {
                type: 'header',
                title: lc('donate')
            },
            {
                id: 'language',
                description: getLocaleDisplayName,
                title: lc('language')
            },
            {
                id: 'dark_mode',
                description: getThemeDisplayName,
                title: lc('theme.title')
            },
            {
                type: 'switch',
                key: 'clock_24',
                value: clock_24,
                title: lc('hours_24_clock')
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
                description: getSavedMBTilesDir,
                rightBtnIcon: 'mdi-chevron-right'
            }
        ]
            .concat(
                PLAY_STORE_BUILD
                    ? [
                          {
                              id: 'share',
                              rightBtnIcon: 'mdi-chevron-right',
                              title: lc('share_application')
                          },
                          {
                              id: 'review',
                              rightBtnIcon: 'mdi-chevron-right',
                              title: lc('review_application')
                          }
                      ]
                    : ([] as any)
            )
            .concat(
                PLAY_STORE_BUILD
                    ? [
                          {
                              id: 'review',
                              rightBtnIcon: 'mdi-chevron-right',
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

        if (!PLAY_STORE_BUILD && ANDROID_30) {
            newItems.push({
                id: 'items_data_path',
                title: lc('items_data_path'),
                description: getItemsDataFolder,
                rightBtnIcon: 'mdi-chevron-right'
            });
        }
        if (customLayers.hasLocalData) {
            newItems.splice(1, 0, {
                id: 'map_language',
                description: () => getLocaleDisplayName(ApplicationSettings.getString('map_language')),
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
                value: customLayers.tokenKeys[k]
            });
        });

        newItems.push(...tokenSettings);
        items = new ObservableArray(newItems);
    }

    async function onLongPress(item, event) {
        try {
            switch (item.id) {
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
    let checkboxTapTimer;
    async function onTap(item, event) {
        DEV_LOG && console.log('onTap', event);
        try {
            if (item.type === 'switch') {
                // we dont want duplicate events so let s timeout and see if we clicking diretly on the checkbox
                const checkboxView: CheckBox = ((event.object as View).parent as View).getViewById('checkbox');
                checkboxTapTimer = setTimeout(() => {
                    checkboxView.checked = !checkboxView.checked;
                }, 10);
                return;
            }
            switch (item.id) {
                case 'export_settings':
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
                        extensions: ['application/json'],
                        multipleSelection: false,
                        pickerMode: 0
                    });
                    const filePath = result.files[0];
                    if (filePath && File.exists(filePath)) {
                        showLoading();
                        const json = JSON.parse(await File.fromPath(filePath).readText());
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
                case 'share':
                    await share({
                        message: GIT_URL
                    });
                    break;
                case 'github':
                    openLink(GIT_URL);
                    break;
                case 'sponsor':
                    openLink(SPONSOR_URL);
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
                case 'dark_mode':
                    await selectTheme();
                    if (__IOS__) {
                        refresh();
                    }
                    break;
                case 'review':
                    openLink(STORE_REVIEW_LINK);
                    break;
                case 'third_party':
                    const ThirdPartySoftwareBottomSheet = (await import('~/components/settings/ThirdPartySoftwareBottomSheet.svelte')).default;
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
                        const OptionSelect = (await import('~/components/common/OptionSelect.svelte')).default;
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

    function selectTemplate(item, index, items) {
        if (item.type === 'prompt') {
            return 'default';
        }
        return item.type || 'default';
    }

    function onCheckBox(item, event) {
        if (item.value === event.value) {
            return;
        }
        const value = event.value;
        if (checkboxTapTimer) {
            clearTimeout(checkboxTapTimer);
            checkboxTapTimer = null;
        }
        try {
            ApplicationSettings.setBoolean(item.key, value);
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    onLanguageChanged((value, event) => {
        if (event.clock_24 !== true) {
            refresh();
        }
    });
    onMapLanguageChanged(refresh);
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,*">
        <collectionview bind:this={collectionView} itemTemplateSelector={selectTemplate} {items} row={1} android:paddingBottom={$navigationBarHeight}>
            <Template key="header" let:item>
                <gridlayout rows="auto,auto">
                    <stacklayout
                        backgroundColor="#ea4bae"
                        borderRadius={10}
                        horizontalAlignment="center"
                        margin="10 16 0 16"
                        orientation="horizontal"
                        padding={10}
                        rippleColor="white"
                        verticalAlignment="center"
                        on:tap={(event) => onTap({ id: 'sponsor' }, event)}>
                        <label color="white" fontFamily={$fonts.mdi} fontSize={26} marginRight={10} text="mdi-heart" verticalAlignment="center" />
                        <label color="white" fontSize={12} text={item.title} textWrap={true} verticalAlignment="center" />
                    </stacklayout>

                    <stacklayout horizontalAlignment="center" marginBottom={0} marginTop={20} row={1} verticalAlignment="center">
                        <image borderRadius="50%" height={50} horizontalAlignment="center" src="res://icon" width={50} />
                        <label fontSize={13} marginTop={4} text={version} />
                    </stacklayout>
                </gridlayout>
            </Template>
            <Template key="switch" let:item>
                <ListItemAutoSize leftIcon={item.icon} mainCol={1} subtitle={getSubtitle(item)} title={getTitle(item)} on:tap={(event) => onTap(item, event)}>
                    <switch id="checkbox" checked={item.value} col={2} on:checkedChange={(e) => onCheckBox(item, e)} />
                </ListItemAutoSize>
            </Template>
            <Template key="checkbox" let:item>
                <ListItemAutoSize leftIcon={item.icon} mainCol={1} subtitle={getSubtitle(item)} title={getTitle(item)} on:tap={(event) => onTap(item, event)}>
                    <checkbox id="checkbox" checked={item.value} col={2} on:checkedChange={(e) => onCheckBox(item, e)} />
                </ListItemAutoSize>
            </Template>
            <Template let:item>
                <ListItemAutoSize
                    leftIcon={item.icon}
                    rightIcon={item.rightBtnIcon}
                    rightValue={item.rightValue}
                    showBottomLine={false}
                    subtitle={getSubtitle(item)}
                    title={getTitle(item)}
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
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapsed'} />
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
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapsed'} />
                    </stacklayout>

                    <label
                        col={2}
                        color={colorOnSurfaceVariant}
                        marginLeft={16}
                        marginRight={16}
                        text={item.rightValue && item.rightValue()}
                        verticalAlignment="middle"
                        visibility={!!item.rightValue ? 'visible' : 'collapsed'} />
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
        <CActionBar canGoBack title={$slc('settings')} />
    </gridlayout>
</page>
