<script lang="ts">
    // a route's own page: its tiles, its profile read through the lens, then one card per feature section.
    // One collectionview: a section is its header row and, while open, its body rows
    import type { TouchGestureEventData } from '@nativescript/core';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import CActionBar from '@shared/components/CActionBar.svelte';
    import { showError } from '@shared/utils/showError';
    import { goBack, navigate } from '@shared/utils/svelte/ui';
    import RouteStatTiles from '~/components/bottomsheet/RouteStatTiles.svelte';
    import WhenPanel from '~/routeFeatures/page/WhenPanel.svelte';
    import { departurePassed, resolveStart, routeTimeZone } from '~/utils/routeAnalysis/departure';
    import { withDeparture } from '~/utils/routeAnalysis/storage';
    import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';
    import type { RouteAnalysis } from '~/utils/routeAnalysis/types';
    import { onDestroy, tick } from 'svelte';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import type { CollectionView } from '@nativescript-community/ui-collectionview';
    import { formatTime, lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { Item } from '~/models/Item';
    import RouteLensCard from '~/routeFeatures/lens/RouteLensCard.svelte';
    import RouteHeroMap from '~/routeFeatures/page/RouteHeroMap.svelte';
    import { focusKeyOf, focusSection } from '~/routeFeatures/lens/routeFocusStore';
    import { selectLens } from '~/routeFeatures/lens/routeLensStore';
    import { type PageRow, type StoredSections, pageRows, toggledSections } from '~/routeFeatures/page/rows';
    import { type LensId, type LensSection, type RoutePageSection, lazyComponents, routeFeatureChanges, routeFeatures, routePageSections } from '~/routeFeatures/registry';
    import { packageService } from '~/services/PackageService';
    import { computeRouteProgress, isLocationOnRoute, isNavigableRoute } from '~/utils/navigation';
    import { showPopoverMenu } from '~/utils/ui/index.common';
    import { colors, fonts, screenWidthDips, windowInset } from '~/variables';

    export let item: Item;
    /** opened from the Time tile: the When panel shows */
    export let openWhen = false;

    let {
        colorCanvas,
        colorCard,
        colorErrorContainer,
        colorOnErrorContainer,
        colorOnSurface,
        colorOnSurfaceVariant,
        colorOutlineVariant,
        colorPrimary,
        colorPrimaryContainer,
        colorSurface,
        colorSurfaceFill
    } = $colors;
    $: ({
        colorCanvas,
        colorCard,
        colorErrorContainer,
        colorOnErrorContainer,
        colorOnSurface,
        colorOnSurfaceVariant,
        colorOutlineVariant,
        colorPrimary,
        colorPrimaryContainer,
        colorSurface,
        colorSurfaceFill
    } = $colors);

    // the lens bar, its insight line, the chart and the grade legend under it
    const PROFILE_HEIGHT = 44 + 40 + 150 + 24;
    const SECTION_HEADER_HEIGHT = 56;
    const CARD_RADIUS = 16;

    // the hero map lies behind the list, whose first row is see-through: the cards slide over the map as the page scrolls
    const HERO_HEIGHT = 240;

    const mapContext = getMapContext();
    let heroFailed = false;
    let heroMap: RouteHeroMap;
    // the list catches every touch, over its see-through row too: the row hands them on to the map behind it.
    // A drag that starts on the map moves the map, not the page. Android: on iOS the list lets nothing through either
    function forwardToHero(args: TouchGestureEventData) {
        if (!__ANDROID__) {
            return;
        }
        const target: android.view.View = heroMap?.touchTarget();
        const row: android.view.View = args.view?.nativeViewProtected;
        const event: android.view.MotionEvent = args.android;
        if (!target || !row || !event) {
            return;
        }
        if (event.getActionMasked() === android.view.MotionEvent.ACTION_DOWN) {
            row.getParent()?.requestDisallowInterceptTouchEvent(true);
        }
        const rowOrigin = Array.create('int', 2);
        const targetOrigin = Array.create('int', 2);
        row.getLocationOnScreen(rowOrigin);
        target.getLocationOnScreen(targetOrigin);
        const copy = android.view.MotionEvent.obtain(event);
        copy.offsetLocation(rowOrigin[0] - targetOrigin[0], rowOrigin[1] - targetOrigin[1]);
        target.dispatchTouchEvent(copy);
        copy.recycle();
    }
    const sectionComponents = lazyComponents();

    $: title = formatter.getItemTitle(item);
    $: subtitle = formatter.getItemSubtitle(item, title);

    $: sections = $routeFeatureChanges >= 0 ? routePageSections($routeFeatures) : [];
    // what the user opened, for this visit only: the page always opens on its tiles and profile
    let stored: StoredSections = {};
    $: rows = $routeFeatureChanges >= 0 ? pageRows({ sections, ctx: { item }, stored, hasProfile: !!item?.profile?.data?.length }) : [];
    type ListRow = PageRow | { type: 'hero'; key: 'hero' } | { type: 'passed'; key: 'passed' } | { type: 'when'; key: 'when' };
    let listRows: ListRow[];
    $: listRows = [
        ...(heroFailed ? [] : [{ type: 'hero' as const, key: 'hero' as const }]),
        ...(departureGone ? [{ type: 'passed' as const, key: 'passed' as const }] : []),
        ...rows.flatMap((row): ListRow[] => (row.type === 'tiles' && whenOpen ? [row, { type: 'when', key: 'when' }] : [row]))
    ];

    // the departure: the When pill says it, the panel under the tiles sets it
    let whenOpen = openWhen;
    let now = Date.now();
    const clockTimer = setInterval(() => (now = Date.now()), 60000);
    onDestroy(() => clearInterval(clockTimer));
    $: analysis = analysisVersion >= 0 ? item?.analysis : null;
    $: departure = analysis?.inputs.departure ?? { mode: 'now' as const };
    $: startAt = resolveStart(departure, now);
    $: timeline = analysis ? buildTimeline(timelineSource(item), analysis.inputs, now) : null;
    $: arrivalAt = timeline?.t.length ? timeline.at(timeline.t.length - 1) : item?.route?.totalTime ? startAt + item.route.totalTime * 1000 : NaN;
    $: passed = departurePassed(departure, now);
    // the banner offers to move a plan that has gone by; "keep" puts it away for this visit
    let keepPassed = false;
    let keptAt: number;
    $: if (departure.mode === 'planned' && departure.at !== keptAt) {
        keepPassed = false;
    }
    function keepDeparture() {
        keepPassed = true;
        keptAt = departure.mode === 'planned' ? departure.at : undefined;
    }
    $: departureGone = passed && !keepPassed;
    $: zone = routeTimeZone(departure);
    function clock(at: number) {
        return formatTime(at, 'LT', zone.offset);
    }
    $: whenLabel = `${departure.mode === 'planned' ? clock(departure.at) : lc('now')}${isNaN(arrivalAt) ? '' : ' → ' + clock(arrivalAt)}`;

    // the times change in place: only what shows them follows. The activity changes what the whole page reads
    let analysisVersion = 0;
    // one save after the other: a slow one must not land after, and over, a newer one
    let saving: Promise<unknown> = Promise.resolve();
    function onAnalysisChange({ analysis, full }: { analysis: RouteAnalysis; full?: boolean }) {
        item.analysis = analysis;
        analysisVersion++;
        if (full) {
            item = item;
        }
        if (isSaved(item)) {
            saving = saving.then(() => mapContext.mapModule('items').updateItem(item, { analysis }, false, false)).catch(showError);
        }
    }
    // an unsaved route keeps its analysis on the item until it is saved with it
    function isSaved(route: Item) {
        return route?.id !== undefined && route.id !== null;
    }
    function departNow() {
        onAnalysisChange({ analysis: withDeparture(item.analysis, item.geometry, { mode: 'now' }) });
    }
    $: rows.forEach((row) => row.type === 'section' && row.open && sectionComponents.load(row.section.id, row.section.component));
    $: sectionsById = Object.fromEntries(sections.map((section) => [section.id, section]));

    function itemTemplateSelector(row: ListRow) {
        return row.type;
    }

    function toggleSection(section: RoutePageSection) {
        stored = toggledSections(stored, section);
    }

    // the insight line's `›` on this page: the lens' own section, opened and brought into view
    let listView: NativeViewElementNode<CollectionView>;
    function sectionOf(lens: LensId) {
        const section = sections.find((candidate) => candidate.lens === lens);
        if (!section || !rows.some((row) => row.key === 'section:' + section.id)) {
            return undefined;
        }
        return async () => {
            stored = { ...stored, [section.id]: true };
            await tick();
            const index = listRows.findIndex((row) => row.key === 'section:' + section.id);
            if (index >= 0) {
                listView?.nativeView?.scrollToIndex(index, true);
            }
        };
    }

    // a row of a section asks to focus a stretch of the route: it is read in the section's lens
    function focusOn(sectionId: string, section: LensSection) {
        const lens = sectionsById[sectionId]?.lens;
        if (!section || !lens) {
            return;
        }
        selectLens(lens);
        focusSection(focusKeyOf(item), { ...section, lens });
    }

    let lensCard: RouteLensCard;
    // the chart opens its point card once told what is left from there, as the sheet does. The event is typed
    // as a CustomEvent but the shared dispatcher hands the payload itself, hence the `any` the sheet uses too
    function onChartHighlight({ highlight, lat, lon }: any) {
        if (!isNavigableRoute(item)) {
            return;
        }
        const location = { lat, lon };
        const positions = packageService.getRouteItemPoses(item);
        const onPathIndex = isLocationOnRoute(location, positions);
        if (onPathIndex === -1) {
            return;
        }
        const { remainingDistance, remainingDistanceToStep, remainingTime } = computeRouteProgress({ item, location, positions, onPathIndex, computeRemaining: true, computeInstruction: false });
        lensCard?.highlightPathIndex({ onPathIndex, remainingDistance, remainingDistanceToStep, remainingTime, dplus: item.profile?.dplus, dmin: item.profile?.dmin }, highlight, false, true);
    }

    function bodyProps(row: PageRow) {
        return row.type === 'body' && row.row.data !== undefined ? { data: row.row.data } : {};
    }

    async function showMenu(event) {
        try {
            const options = [
                { id: 'show_on_map', icon: 'mdi-map-outline', name: lc('show_on_map') },
                { id: 'share', icon: 'mdi-share-variant', name: lc('share') },
                ...(isSaved(item) ? [{ id: 'edit', icon: 'mdi-pencil', name: lc('edit') }] : [])
            ];
            await showPopoverMenu({
                options,
                anchor: event.object,
                vertPos: VerticalPosition.BELOW,
                onClose: async (result) => {
                    switch (result?.id) {
                        case 'show_on_map':
                            showOnMap();
                            break;
                        case 'share':
                            await mapContext.mapModule('items').shareItemsAsGeoJSON([item]);
                            break;
                        case 'edit': {
                            // the item's own form: its name, colour and style
                            const ItemEdit = (await import('~/components/items/ItemEdit.svelte')).default;
                            navigate({ page: ItemEdit, props: { item } });
                            break;
                        }
                    }
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    // the main map, wherever the page was opened from: the items list may be between them
    function showOnMap() {
        goBack({ to: mapContext.getMainPage() });
        mapContext.selectItem({ item, isFeatureInteresting: true });
    }
</script>

<page actionBarHidden={true} on:navigatingFrom={(event) => event.isBackNavigation && heroMap?.dispose()}>
    <gridlayout backgroundColor={colorCanvas} rows="auto,*">
        <CActionBar canGoBack title={null}>
            <stacklayout slot="center" col={1} verticalAlignment="middle">
                <label color={colorOnSurface} fontSize={15} fontWeight="bold" lineBreak="end" maxLines={2} text={title || ''} />
                <label color={colorOnSurfaceVariant} fontSize={11.5} lineBreak="end" maxLines={1} text={subtitle || ''} visibility={subtitle ? 'visible' : 'collapse'} />
            </stacklayout>
            <!-- a long press leaves now -->
            <gridlayout
                backgroundColor={passed ? colorErrorContainer : departure.mode === 'planned' ? colorPrimaryContainer : null}
                borderColor={colorOutlineVariant}
                borderRadius={14}
                borderWidth={1}
                height={28}
                padding="0 8"
                rippleColor={colorPrimary}
                verticalAlignment="middle"
                on:tap={() => (whenOpen = !whenOpen)}
                on:longPress={departNow}>
                <stacklayout orientation="horizontal" verticalAlignment="middle">
                    <label color={colorOnSurface} fontFamily={$fonts.mdi} fontSize={14} text="mdi-clock-outline" verticalAlignment="middle" />
                    <label color={colorOnSurface} fontSize={12} paddingLeft={4} text={whenLabel} verticalAlignment="middle" />
                </stacklayout>
            </gridlayout>
            <mdbutton class="actionBarButton" text="mdi-dots-vertical" variant="text" on:tap={showMenu} />
        </CActionBar>
        {#if !heroFailed}
            <RouteHeroMap bind:this={heroMap} height={HERO_HEIGHT} {item} row={1} verticalAlignment="top" on:failed={() => (heroFailed = true)} />
        {/if}
        <!-- see-through over the hero map, every other row opaque -->
        <collectionview
            bind:this={listView}
            backgroundColor="transparent"
            {itemTemplateSelector}
            items={listRows}
            paddingBottom={16 + (__ANDROID__ ? $windowInset.bottom : 0)}
            row={1}
            ios:contentInsetAdjustmentBehavior={2}>
            <Template key="hero">
                <gridlayout height={HERO_HEIGHT} on:touch={forwardToHero}>
                    <stacklayout horizontalAlignment="right" padding={8} verticalAlignment="top">
                        <mdbutton class="small-floating-btn" backgroundColor={colorSurface} color={colorOnSurface} text="mdi-arrow-expand" on:tap={showOnMap} />
                        <!-- the whole route again, after a section or a point was looked at -->
                        <mdbutton
                            class="small-floating-btn"
                            backgroundColor={colorSurface}
                            color={colorOnSurface}
                            marginTop={8}
                            text="mdi-fit-to-screen-outline"
                            on:tap={() => heroMap?.showWholeRoute()} />
                    </stacklayout>
                </gridlayout>
            </Template>
            <Template key="passed">
                <gridlayout backgroundColor={colorCanvas} padding="8 6 0 6">
                    <gridlayout backgroundColor={colorErrorContainer} borderRadius={CARD_RADIUS} columns="*,auto,auto" padding="8 12">
                        <label
                            color={colorOnErrorContainer}
                            fontSize={13}
                            text={lc('when_departure_passed', departure.mode === 'planned' ? clock(departure.at) : '')}
                            textWrap={true}
                            verticalAlignment="middle" />
                        <mdbutton col={1} text={lc('when_use_now')} variant="text" verticalAlignment="middle" on:tap={departNow} />
                        <mdbutton col={2} text={lc('when_keep')} variant="text" verticalAlignment="middle" on:tap={keepDeparture} />
                    </gridlayout>
                </gridlayout>
            </Template>
            <Template key="when">
                <gridlayout backgroundColor={colorCanvas} padding="8 6 0 6">
                    <gridlayout backgroundColor={colorCard} borderRadius={CARD_RADIUS}>
                        <WhenPanel {item} version={analysisVersion} on:change={onAnalysisChange} />
                    </gridlayout>
                </gridlayout>
            </Template>
            <Template key="tiles">
                <!-- the tiles keep their own 40 high: the row around them does not follow what they show -->
                <gridlayout backgroundColor={colorCanvas} height={48} paddingTop={8}>
                    <RouteStatTiles {item} sheetWidth={screenWidthDips} version={analysisVersion} on:when={() => (whenOpen = !whenOpen)} />
                </gridlayout>
            </Template>
            <Template key="profile">
                <gridlayout backgroundColor={colorCanvas} padding="8 6 0 6">
                    <gridlayout backgroundColor={colorCard} borderRadius={CARD_RADIUS} height={PROFILE_HEIGHT}>
                        <RouteLensCard bind:this={lensCard} besideMap={false} {item} moreFor={sectionOf} on:highlight={onChartHighlight} />
                    </gridlayout>
                </gridlayout>
            </Template>
            <Template key="section" let:item={row}>
                <gridlayout backgroundColor={colorCanvas} padding="8 6 0 6">
                    <gridlayout
                        backgroundColor={colorCard}
                        borderRadius={row.open ? `${CARD_RADIUS} ${CARD_RADIUS} 0 0` : CARD_RADIUS}
                        columns="36,*,auto"
                        height={SECTION_HEADER_HEIGHT}
                        padding="0 12"
                        rippleColor={colorPrimary}
                        on:tap={() => toggleSection(row.section)}>
                        <label
                            backgroundColor={colorSurfaceFill}
                            borderRadius={10}
                            color={colorOnSurfaceVariant}
                            fontFamily={$fonts.mdi}
                            fontSize={20}
                            height={36}
                            text={row.section.icon}
                            textAlignment="center"
                            verticalTextAlignment="middle"
                            width={36} />
                        <stacklayout col={1} paddingLeft={12} verticalAlignment="middle">
                            <label color={colorOnSurface} fontSize={14.5} fontWeight="bold" text={row.section.title()} />
                            <label color={colorOnSurfaceVariant} fontSize={12} lineBreak="end" maxLines={1} text={row.summary || ''} visibility={row.summary ? 'visible' : 'collapse'} />
                        </stacklayout>
                        <label col={2} color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={22} text={row.open ? 'mdi-chevron-up' : 'mdi-chevron-down'} verticalAlignment="middle" />
                    </gridlayout>
                </gridlayout>
            </Template>
            <Template key="body" let:item={row}>
                <gridlayout backgroundColor={colorCanvas} padding="0 6">
                    <gridlayout backgroundColor={colorCard} borderRadius={row.last ? `0 0 ${CARD_RADIUS} ${CARD_RADIUS}` : 0} height={row.row.height ?? 'auto'} paddingBottom={row.last ? 8 : 0}>
                        {#if $sectionComponents[row.section]}
                            <svelte:component this={$sectionComponents[row.section]} {item} {...bodyProps(row)} on:focus={(section) => focusOn(row.section, section)} />
                        {/if}
                    </gridlayout>
                </gridlayout>
            </Template>
            <Template key="footer">
                <label backgroundColor={colorCanvas} color={colorOnSurfaceVariant} fontSize={11} padding="16 16 0 16" text={lc('route_page_attribution')} textAlignment="center" />
            </Template>
        </collectionview>
    </gridlayout>
</page>
