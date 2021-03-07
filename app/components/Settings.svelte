<script lang="ts">
    import * as EInfo from '@nativescript-community/extendedinfo';
    import { openUrl } from '@nativescript/core/utils/utils';
    import { Template } from 'svelte-native/components';
    import { showBottomSheet } from '~/components/bottomsheet';
    import { getLocaleDisplayName, lc, onLanguageChanged, selectLanguage, sgetLocaleDisplayName, slc } from '~/helpers/locale';
    import { share } from '~/utils/share';
    import { openLink } from '~/utils/ui';
    import { mdiFontFamily, primaryColor } from '~/variables';
    import CActionBar from './CActionBar.svelte';
    import ThirdPartySoftwareBottomSheet from './ThirdPartySoftwareBottomSheet.svelte';

    const appVersion = EInfo.getVersionNameSync() + '.' + EInfo.getBuildNumberSync();
    function getTitle(item) {
        switch (item.id) {
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
        }
    }
    function getSubtitle(item) {
        switch (item.id) {
            case 'language':
                return '';
            case 'version':
                return appVersion;
            case 'github':
                return lc('get_app_source_code');
            case 'third_party':
                return lc('list_used_third_parties');
        }
        return null;
    }
    let items = [
        {
            id: 'language',
            rightValue: getLocaleDisplayName
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
        },
        {
            id: 'review',
            rightBtnIcon: 'mdi-chevron-right'
        }
    ];
    function onLongPress() {}
    function onTap(command) {
        switch (command) {
            case 'github':
                openLink(GIT_URL);
                break;
            case 'language':
                selectLanguage();
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
        }
    }
    onLanguageChanged(() => (items = items.slice(0)));
</script>

<frame backgroundColor="transparent">
    <page actionBarHidden="true">
        <gridlayout rows="auto,*">
            <CActionBar canGoBack modalWindow title={$slc('settings')} />
            <collectionview row="1" {items} rowHeight="60">
                <Template let:item>
                    <gridLayout
                        columns="auto,*,auto"
                        rippleColor={primaryColor}
                        on:tap={(event) => onTap(item.id)}
                        class="settings-section"
                    >
                        <label
                            fontSize="36"
                            text={item.icon}
                            marginLeft="-10"
                            width="40"
                            verticalAlignment="center"
                            fontFamily={mdiFontFamily}
                            visibility={!!item.icon ? 'visible' : 'hidden'}
                        />
                        <stackLayout col="1" verticalAlignment="center">
                            <label
                                fontSize="17"
                                text={getTitle(item)}
                                textWrap="true"
                                color="black"
                                verticalTextAlignment="top"
                                maxLines="2"
                                lineBreak="end"
                            />
                            <label
                                visibilty={getSubtitle(item) ? 'visible' : 'collapsed'}
                                fontSize="14"
                                text={getSubtitle(item)}
                                verticalTextAlignment="top"
                                color="#aaaaaa"
                                maxLines={2}
                                lineBreak="end"
                            />
                        </stackLayout>

                        <label
                            col="2"
                            visibility={!!item.rightValue ? 'visible' : 'hidden'}
                            text={item.rightValue && item.rightValue()}
                            color="#aaaaaa"
                            verticalAlignment="center"
                            marginRight="16"
                        />
                        <button
                            col="2"
                            variant="text"
                            width="25"
                            height="25"
                            fontSize="20"
                            visibility={!!item.rightBtnIcon ? 'visible' : 'hidden'}
                            class="icon-btn"
                            text={item.rightBtnIcon}
                            on:tap={(event) => onTap(item.id)}
                        />
                        <absoluteLayout
                            row="2"
                            col="1"
                            colSpan="3"
                            backgroundColor="#55cccccc"
                            height="1"
                            verticalAlignment="bottom"
                        />
                    </gridLayout>
                </Template>
            </collectionview>
        </gridlayout>
    </page>
</frame>
