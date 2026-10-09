<script lang="ts">
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';
    import { Utils, View } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import { goBack } from '@shared/utils/svelte/ui';
    import CActionBar from '@shared/components/CActionBar.svelte';
    import GesturePopover from '~/components/tutorial/GesturePopover.svelte';
    import IconButton from '~/components/common/IconButton.svelte';
    import TutorialScreen from '~/components/tutorial/TutorialScreen.svelte';
    import { SCREEN_HEIGHT, SCREEN_WIDTH, type TutorialZone, tutorialPages } from '~/components/tutorial/tutorialPages';
    import { lc } from '~/helpers/locale';
    import { colors, windowInset } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorOutline, colorPrimary } = $colors);
    $: ({ bottom: windowInsetBottom, left: windowInsetLeft, right: windowInsetRight } = $windowInset);

    let index = 0;
    let selected: TutorialZone = null;
    let seen: string[] = [];
    let scale = 1;

    $: page = tutorialPages[index];
    $: visibleZones = page.zones.filter((zone) => !zone.enabled || zone.enabled());
    $: foundCount = visibleZones.filter((zone) => seen.includes(`${page.id}.${zone.id}`)).length;

    function gotoPage(next: number) {
        if (next < 0 || next >= tutorialPages.length) {
            return;
        }
        index = next;
    }
    async function onZone(zone: TutorialZone, view: View) {
        DEV_LOG && console.log('show gesture popover', zone.id);
        const key = `${page.id}.${zone.id}`;
        if (!seen.includes(key)) {
            seen = [...seen, key];
        }
        selected = zone;
        try {
            await showPopover({
                view: GesturePopover,
                anchor: view,
                vertPos: zone.y + zone.height / 2 > SCREEN_HEIGHT / 2 ? VerticalPosition.ABOVE : VerticalPosition.BELOW,
                horizPos: zone.x + zone.width / 2 > SCREEN_WIDTH / 2 ? HorizontalPosition.ALIGN_RIGHT : HorizontalPosition.ALIGN_LEFT,
                fitInScreen: true,
                props: { id: zone.id, gesture: zone.gesture }
            });
        } catch (error) {
            showError(error);
        } finally {
            selected = null;
        }
    }
    // 1: swiped right, 2: swiped left
    function onSwipe(event) {
        gotoPage(index + (event.direction === 2 ? 1 : event.direction === 1 ? -1 : 0));
    }
    // the screen is a fixed-size schematic: shrink it to fit what the page leaves, never grow it
    function onAreaLayout(event) {
        const view = event.object as View;
        const width = Utils.layout.toDeviceIndependentPixels(view.getMeasuredWidth());
        const height = Utils.layout.toDeviceIndependentPixels(view.getMeasuredHeight());
        scale = Math.min(1, (width - 16) / SCREEN_WIDTH, (height - 8) / SCREEN_HEIGHT);
    }
</script>

<page actionBarHidden={true}>
    <gridlayout paddingLeft={windowInsetLeft} paddingRight={windowInsetRight} rows="auto,auto,*,auto,auto">
        <CActionBar title={lc('gestures_tips')} />
        <gridlayout columns="*,auto" margin="8 16 0 16" row={1}>
            <label color={colorOnSurface} fontSize={17} fontWeight="bold" text={lc(`tutorial_page_${page.id}`)} />
            <label col={1} color={colorOnSurfaceVariant} fontSize={13} text={`${foundCount} / ${visibleZones.length}`} verticalAlignment="middle" />
        </gridlayout>
        <gridlayout row={2} on:layoutChanged={onAreaLayout} on:swipe={onSwipe}>
            {#key page.id}
                <TutorialScreen {onZone} {page} scaleX={scale} scaleY={scale} {seen} selected={selected?.id} />
            {/key}
        </gridlayout>
        <label color={colorOnSurfaceVariant} fontSize={13} margin="8 16 0 16" row={3} text={lc('gestures_hint')} textWrap={true} />
        <gridlayout columns="auto,*,auto" margin="0 8" android:marginBottom={windowInsetBottom} row={4}>
            <IconButton isHidden={true} isVisible={index > 0} text="mdi-chevron-left" on:tap={() => gotoPage(index - 1)} />
            <stacklayout col={1} horizontalAlignment="center" orientation="horizontal" verticalAlignment="middle">
                {#each tutorialPages as dotPage, dotIndex (dotPage.id)}
                    <gridlayout backgroundColor={dotIndex === index ? colorPrimary : colorOutline} borderRadius={4} height={8} margin="0 4" width={8} on:tap={() => gotoPage(dotIndex)} />
                {/each}
            </stacklayout>
            <IconButton col={2} text={index < tutorialPages.length - 1 ? 'mdi-chevron-right' : 'mdi-check'} on:tap={() => (index < tutorialPages.length - 1 ? gotoPage(index + 1) : goBack())} />
        </gridlayout>
    </gridlayout>
</page>
