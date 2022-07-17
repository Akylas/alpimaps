<script lang="ts">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { ApplicationSettings, ObservableArray } from '@nativescript/core';
    import { dismissSoftInput, openUrl } from '@nativescript/core/utils/utils';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { showBottomSheet } from '~/utils/svelte/bottomsheet';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { getLocaleDisplayName, l, lc, onLanguageChanged, selectLanguage, slc } from '~/helpers/locale';
    import { getThemeDisplayName, onThemeChanged, selectTheme } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { share } from '~/utils/share';
    import { openLink } from '~/utils/ui';
    import { borderColor, mdiFontFamily } from '~/variables';
    import CActionBar from './CActionBar.svelte';
    import ThirdPartySoftwareBottomSheet from './ThirdPartySoftwareBottomSheet.svelte';

    let collectionView: NativeViewElementNode<CollectionView>;

    let items: ObservableArray<any>;
    const customLayers = getMapContext().mapModule('customLayers');
    let geoHandler: GeoHandler;
    onServiceLoaded((handler: GeoHandler) => {
        geoHandler = handler;
        refresh();
    });
    // onThemeChanged(() => {
    //     collectionView && (collectionView.nativeView as CollectionView).refreshVisibleItems();
    // });

    const appVersion = __APP_VERSION__ + ' Build ' + __APP_BUILD_NUMBER__;
    function getTitle(item) {
        switch (item.id) {
            case 'dark_mode':
                return lc('dark_mode');
            case 'language':
                return lc('language');
            case 'version':
                return lc('version');
            case 'github':
                return lc('source_code');
            case 'share':
                return lc('share_application');

            case 'review':
                return lc('review_application');

            case 'third_party':
                return lc('third_parties');
            case 'token':
                return lc(item.token);
            case 'setting':
                return item.title;
        }
    }
    function getSubtitle(item) {
        switch (item.id) {
            case 'version':
                return appVersion;
            case 'token':
                return item.value;
            case 'github':
                return lc('get_app_source_code');
            case 'third_party':
                return lc('list_used_third_parties');
            case 'setting':
                return item.description;
        }
        return '';
    }
    function refresh() {
        let newItems = [
            {
                id: 'language',
                rightValue: getLocaleDisplayName
            },
            {
                id: 'dark_mode',
                rightValue: getThemeDisplayName
            },
            {
                id: 'version'
            },
            {
                id: 'github',
                rightBtnIcon: 'mdi-chevron-right'
            },
            {
                id: 'third_party',
                rightBtnIcon: 'mdi-chevron-right'
            },
            {
                id: 'share',
                rightBtnIcon: 'mdi-chevron-right'
            }
            // {
            //     id: 'review',
            //     rightBtnIcon: 'mdi-chevron-right'
            // }
        ];
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
    async function onTap(command, item?) {
        try {
            switch (command) {
                case 'github':
                    openLink(GIT_URL);
                    break;
                case 'language':
                    selectLanguage();
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
                    openUrl(STORE_REVIEW_LINK);
                    break;
                case 'third_party':
                    showBottomSheet({
                        parent: this,
                        view: ThirdPartySoftwareBottomSheet,
                        ignoreTopSafeArea: true,
                        trackingScrollView: 'trackingScrollView'
                    });
                    break;
                case 'setting': {
                    if (item.type === 'prompt') {
                        const result = await prompt({
                            title: getTitle(item),
                            okButtonText: l('save'),
                            cancelButtonText: l('cancel'),
                            autoFocus: true,
                            defaultText: ApplicationSettings.getNumber(item.key, item.default) + ''
                        });
                        dismissSoftInput();
                        if (result && !!result.result && result.text.length > 0) {
                            ApplicationSettings.setNumber(item.key, parseInt(result.text));
                            const index = items.findIndex((it) => it.key === item.key);
                            if (index !== -1) {
                                items.setItem(index, item);
                            }
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
                            const index = items.findIndex((it) => it.key === item.key);
                            if (index !== -1) {
                                items.setItem(index, item);
                            }
                        }
                    }

                    break;
                }
                case 'token': {
                    const result = await prompt({
                        title: lc('token_key', item.token),
                        okButtonText: l('save'),
                        cancelButtonText: l('cancel'),
                        autoFocus: true,
                        defaultText: item.value
                    });
                    dismissSoftInput();
                    if (result && !!result.result && result.text.length > 0) {
                        customLayers.tokenKeys[item.token] = result.text;
                        item.value = result.text;
                        ApplicationSettings.setString(item.token + 'Token', result.text);
                        const index = items.findIndex((it) => it.token === item.token);
                        if (index !== -1) {
                            items.setItem(index, item);
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
    onLanguageChanged(refresh);

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
        <CActionBar canGoBack title={lc('settings')} />
        <collectionview bind:this={collectionView} row={1} {items} rowHeight="70" itemTemplateSelector={selectTemplate}>
            <Template let:item key="switch">
                <gridlayout columns="*, auto" padding="0 10 0 30">
                    <stackLayout verticalAlignment="center">
                        <label fontSize="17" text={getTitle(item)} textWrap="true" verticalTextAlignment="top" maxLines={2} lineBreak="end" />
                        <label
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapsed'}
                            fontSize="14"
                            class="subtitle"
                            text={getSubtitle(item)}
                            verticalTextAlignment="top"
                            maxLines={2}
                            lineBreak="end"
                        />
                    </stackLayout>
                    <switch col={1} checked={item.value} on:checkedChange={(e) => onCheckBox(item, e.value)} verticalAlignment="center" />
                    <absoluteLayout colSpan={2} backgroundColor={$borderColor} height="1" verticalAlignment="bottom" />
                </gridlayout>
            </Template>
            <Template let:item>
                <gridLayout columns="auto,*,auto" class="textRipple" on:tap={(event) => onTap(item.id, item)}>
                    <label fontSize={36} text={item.icon} marginLeft="-10" width="40" verticalAlignment="center" fontFamily={mdiFontFamily} visibility={!!item.icon ? 'visible' : 'hidden'} />
                    <stackLayout col={1} verticalAlignment="center">
                        <label fontSize="17" text={getTitle(item)} textWrap="true" verticalTextAlignment="top" maxLines={2} lineBreak="end" />
                        <label
                            visibility={getSubtitle(item).length > 0 ? 'visible' : 'collapsed'}
                            fontSize="14"
                            class="subtitle"
                            text={getSubtitle(item)}
                            verticalTextAlignment="top"
                            maxLines={2}
                            lineBreak="end"
                        />
                    </stackLayout>

                    <label
                        col={2}
                        visibility={!!item.rightValue ? 'visible' : 'collapsed'}
                        text={item.rightValue && item.rightValue()}
                        class="subtitle"
                        verticalAlignment="center"
                        marginRight={16}
                        marginLeft={16}
                    />
                    <label
                        col={2}
                        width="25"
                        height="25"
                        fontSize="20"
                        horizontalAlignment="right"
                        visibility={!!item.rightBtnIcon ? 'visible' : 'hidden'}
                        class="icon-btn"
                        marginLeft={10}
                        marginRight={10}
                        text={item.rightBtnIcon}
                    />
                    <absoluteLayout row={2} col={1} colSpan={3} backgroundColor={$borderColor} height="1" verticalAlignment="bottom" />
                </gridLayout>
            </Template>
        </collectionview>
    </gridlayout>
</page>
