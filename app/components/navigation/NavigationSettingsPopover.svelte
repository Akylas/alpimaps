<script context="module" lang="ts">
    import { lc } from '@nativescript-community/l';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { onThemeChanged } from '~/helpers/theme';
    import { colors, fontScaleMaxed, fonts, screenHeightDips, screenWidthDips } from '~/variables';
    import PopoverBackgroundView from '@shared/components/PopoverBackgroundView.svelte';
    import SettingsSlider from '@shared/components/SettingsSlider.svelte';
    import SettingsSwitch from '../settings/SettingsSwitch.svelte';
</script>

<script lang="ts">
    import { NAVIGATION_PARAMS, getNavigationQuickSettings } from '~/stores/navigationStore';

    $: ({ colorOnSurface, colorOutlineVariant, colorWidgetBackground } = $colors);

    // only the subset flagged `quick`: the full list lives in the settings screen
    let settings = getNavigationQuickSettings();

    function onCheckBox(item, value) {
        item.store.set(value);
    }
    function onReset() {
        NAVIGATION_PARAMS.forEach((param) => param.store.reset());
        settings = getNavigationQuickSettings();
    }

    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());
    let collectionView: NativeViewElementNode<CollectionView>;
</script>

<PopoverBackgroundView backgroundColor={colorWidgetBackground} columns="*" rows="*,auto" width={Math.min(screenWidthDips * 0.8 * $fontScaleMaxed, screenWidthDips * 0.95)} {...$$restProps}>
    <collectionview
        bind:this={collectionView}
        height={Math.min(80 * $fontScaleMaxed * settings.length, screenHeightDips - 200)}
        itemTemplateSelector={(item) => (item.type === 'switch' ? item.type : 'default')}
        items={settings}>
        <Template let:item>
            <SettingsSlider borderBottomColor={colorOutlineVariant} borderBottomWidth={1} {...item} />
        </Template>
        <Template key="switch" let:item>
            <SettingsSwitch borderBottomColor={colorOutlineVariant} borderBottomWidth={1} {item} {onCheckBox} />
        </Template>
    </collectionview>
    <mdbutton
        color={colorOnSurface}
        horizontalAlignment="left"
        rippleColor={colorOnSurface}
        row={1}
        textAlignment="center"
        variant="text"
        verticalTextAlignment="center"
        android:padding="8 4 0 4"
        on:tap={onReset}>
        <cspan fontFamily={$fonts.mdi} fontSize={20} text="mdi-cancel" verticalAlignment="middle" />
        <cspan fontSize={16} text={lc('reset_settings')} verticalAlignment="middle" />
    </mdbutton>
</PopoverBackgroundView>
