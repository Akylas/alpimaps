<script lang="ts">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { pickFolder } from '@nativescript-community/ui-document-picker';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { ApplicationSettings, ObservableArray, Utils } from '@nativescript/core';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { clock_24, getLocaleDisplayName, l, lc, onLanguageChanged, onMapLanguageChanged, selectLanguage, selectMapLanguage, slc } from '~/helpers/locale';
    import { getThemeDisplayName, selectTheme } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { share } from '~/utils/share';
    import { showBottomSheet } from '~/utils/svelte/bottomsheet';
    import { openLink } from '~/utils/ui';
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
        let newItems = [
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
            // {
            //     id: 'share',
            //     rightBtnIcon: 'mdi-chevron-right',
            //     title: lc('share_application')
            // },
            {
                id: 'data_path',
                title: lc('map_data_path'),
                description: ApplicationSettings.getString('local_mbtiles_directory'),
                rightBtnIcon: 'mdi-chevron-right'
            }
        ];
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

    function onLongPress() {}
    function updateItem(item) {
        const index = items.findIndex((it) => it.key === item.key);
        if (index !== -1) {
            items.setItem(index, item);
        }
    }
    async function onTap(command, item?) {
        try {
            switch (command) {
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
                        ApplicationSettings.setString('local_mbtiles_directory', resultPath);
                        item.value = resultPath;
                        updateItem(item);
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
                                ApplicationSettings.setNumber(item.key, parseInt(result.text));
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
                        updateItem(item);
                    }
                }
            }
        } catch (err) {
            console.error(err);
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
            console.error(error);
        }
    }
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,*">
        <collectionview bind:this={collectionView} row={1} {items} rowHeight={70} itemTemplateSelector={selectTemplate} android:paddingBottom={$navigationBarHeight}>
            
            <Template let:item key="switch">
                <gridlayout columns="*, auto" padding="0 10 0 30">
                    <stacklayout verticalAlignment="middle">
                        <label fontSize={17} text={getTitle(item)} verticalTextAlignment="top" maxLines={1} lineBreak="end" />
                        <label
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapsed'}
                            fontSize={14}
                            color={$subtitleColor}
                            text={getSubtitle(item)}
                            verticalTextAlignment="top"
                            maxLines={2}
                            lineBreak="end"
                        />
                    </stacklayout>
                    <switch col={1} checked={item.value} on:checkedChange={(e) => onCheckBox(item, e.value)} verticalAlignment="middle" />
                    <absolutelayout colSpan={2} backgroundColor={$borderColor} height={1} verticalAlignment="bottom" />
                </gridlayout>
            </Template>
            <Template let:item>
                <gridlayout columns="auto,*,auto" class="textRipple" on:tap={(event) => onTap(item.id, item)} on:touch={(e) => onTouch(item, e)}>
                    <label fontSize={36} text={item.icon} marginLeft="-10" width={40} verticalAlignment="middle" fontFamily={mdiFontFamily} visibility={!!item.icon ? 'visible' : 'hidden'} />
                    <stacklayout col={1} verticalAlignment="middle">
                        <label fontSize={17} text={getTitle(item)} textWrap="true" verticalTextAlignment="top" maxLines={1} lineBreak="end" />
                        <label
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapsed'}
                            fontSize={14}
                            color={$subtitleColor}
                            text={getSubtitle(item)}
                            verticalTextAlignment="top"
                            maxLines={2}
                            lineBreak="end"
                        />
                    </stacklayout>

                    <label
                        col={2}
                        visibility={!!item.rightValue ? 'visible' : 'collapsed'}
                        text={item.rightValue && item.rightValue()}
                        color={$subtitleColor}
                        verticalAlignment="middle"
                        marginRight={16}
                        marginLeft={16}
                    />
                    <label
                        col={2}
                        width={25}
                        height={25}
                        fontSize={30}
                        horizontalAlignment="right"
                        visibility={!!item.rightBtnIcon ? 'visible' : 'hidden'}
                        class="mdi"
                        color={$subtitleColor}
                        marginLeft={10}
                        marginRight={10}
                        text={item.rightBtnIcon}
                    />
                    <absolutelayout row={2} col={1} colSpan={3} backgroundColor={$borderColor} height={1} verticalAlignment="bottom" />
                </gridlayout>
            </Template>
        </collectionview>
        <CActionBar canGoBack title={$slc('settings')} />
    </gridlayout>
</page>
