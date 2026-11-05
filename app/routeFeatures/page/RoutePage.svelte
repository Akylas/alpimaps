<script lang="ts">
    // a route's own page: its tiles, its profile read through the lens, then one card per feature section.
    // One collectionview: a section is its header row and, while open, its body rows
    import { ObservableArray } from '@nativescript/core';
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
    import { onDestroy } from 'svelte';
    import { get } from 'svelte/store';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import type { CollectionView } from '@nativescript-community/ui-collectionview';
    import { formatTime, lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { Item } from '~/models/Item';
    import RouteLensCard from '~/routeFeatures/lens/RouteLensCard.svelte';
    import RouteHeroMap from '~/routeFeatures/page/RouteHeroMap.svelte';
    import { analysisChanged } from '~/routeFeatures/analysisRunner';
    import { focusKeyOf, focusSection } from '~/routeFeatures/lens/routeFocusStore';
    import { selectLens } from '~/routeFeatures/lens/routeLensStore';
    import { type ListRow, type PageRow, type StoredSections, bodyRows, isSectionOpen, pageRows } from '~/routeFeatures/page/rows';
    import { type LensId, type LensSection, type RoutePageSection, lazyComponents, routeFeatureChanges, routeFeatures, routePageSections } from '~/routeFeatures/registry';
    import { ROUTE_LENS_CARD_HEIGHT } from '~/utils/navigation';
    import { shareItem } from '~/mapModules/itemActions';
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
    const SECTION_HEADER_HEIGHT = 56;
    const CARD_RADIUS = 16;

    // the hero map is the list's first row: it scrolls away with the page
    const HERO_HEIGHT = 240;

    const mapContext = getMapContext();
    let heroMap: RouteHeroMap;
    const sectionComponents = lazyComponents();

    $: title = formatter.getItemTitle(item);
    // the name, not the title: an unnamed route's title is its address, which the subtitle would repeat
    $: subtitle = formatter.getItemSubtitle(item, formatter.getItemName(item));

    $: sections = routePageSections($routeFeatures);
    // what the user opened, for this visit only: the page always opens on its tiles and profile
    let stored: StoredSections = {};
    // the card is the profile feature's, which the user can switch off
    const hasProfileCard = get(routeFeatures).some((feature) => feature.id === 'profile') && !!item?.profile?.data?.length;

    // filled once, then changed where something changed: a new array would rebuild every row, the hero map with it
    const listItems = new ObservableArray<ListRow>([
        { type: 'hero', key: 'hero' },
        ...pageRows({ sections: routePageSections(get(routeFeatures)), ctx: { item }, stored, hasProfile: hasProfileCard })
    ]);
    function indexOfKey(key: string) {
        for (let index = 0; index < listItems.length; index++) {
            if (listItems.getItem(index).key === key) {
                return index;
            }
        }
        return -1;
    }
    function setSectionOpen(section: RoutePageSection, open: boolean) {
        const header = indexOfKey('section:' + section.id);
        if (header < 0) {
            return;
        }
        stored = { ...stored, [section.id]: open };
        const current = listItems.getItem(header);
        const summary = section.summary?.({ item });
        if (current.type !== 'section' || current.open !== open || current.summary !== summary) {
            listItems.setItem(header, { type: 'section', key: 'section:' + section.id, section, open, summary });
        }
        if (open) {
            sectionComponents.load(section.id, section.component);
        }
        showBody(header, open ? bodyRows(section.id, section.rows({ item })) : []);
    }
    // the section's rows under its header: the ones still the same stay, only the rest is spliced
    function showBody(header: number, body: PageRow[]) {
        const sectionKey = listItems.getItem(header).key.slice('section:'.length) + ':';
        let shown = 0;
        while (header + 1 + shown < listItems.length && listItems.getItem(header + 1 + shown).key.startsWith(sectionKey)) {
            shown++;
        }
        let kept = 0;
        while (kept < shown && kept < body.length && sameBody(listItems.getItem(header + 1 + kept), body[kept])) {
            kept++;
        }
        if (shown > kept) {
            listItems.splice(header + 1 + kept, shown - kept);
        }
        if (body.length > kept) {
            listItems.splice(header + 1 + kept, 0, ...body.slice(kept));
        }
        // the card's last row rounds its bottom: the last row kept may have become, or stopped being, the last one
        const shownLast = listItems.getItem(header + kept);
        const nextLast = body[kept - 1];
        if (kept && shownLast.type === 'body' && nextLast.type === 'body' && shownLast.last !== nextLast.last) {
            listItems.setItem(header + kept, nextLast);
        }
    }
    function sameBody(shown: ListRow, next: PageRow) {
        return shown.type === 'body' && next.type === 'body' && shown.key === next.key && JSON.stringify(shown.row.data) === JSON.stringify(next.row.data);
    }
    function toggleSection(section: RoutePageSection) {
        setSectionOpen(section, !isSectionOpen(section, stored));
    }
    // a feature's rows changed (the steep list folded, a setting): every section shows them again, open or not
    function refreshSections(..._changed: unknown[]) {
        sections.forEach((section) => setSectionOpen(section, isSectionOpen(section, stored)));
    }
    $: refreshSections($routeFeatureChanges, item);
    function setRow(row: ListRow, shown: boolean, after: string) {
        const index = indexOfKey(row.key);
        if (shown && index < 0) {
            listItems.splice(indexOfKey(after) + 1, 0, row);
        } else if (!shown && index >= 0) {
            listItems.splice(index, 1);
        }
    }

    // the departure: the When pill says it, the panel under the tiles sets it
    let whenOpen = openWhen;
    let now = Date.now();
    const clockTimer = setInterval(() => (now = Date.now()), 60000);
    onDestroy(() => clearInterval(clockTimer));
    // always true: it reruns this when the analysis changed in place
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
    $: setRow({ type: 'passed', key: 'passed' }, departureGone, 'hero');
    $: setRow({ type: 'when', key: 'when' }, whenOpen, 'tiles');
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
        analysisChanged();
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
    $: sectionsById = Object.fromEntries(sections.map((section) => [section.id, section]));

    function itemTemplateSelector(row: ListRow) {
        return row.type;
    }

    // the insight line's `›` on this page: the lens' own section, opened and brought into view
    let listView: NativeViewElementNode<CollectionView>;
    function sectionOf(lens: LensId) {
        const section = sections.find((candidate) => candidate.lens === lens);
        if (!section || indexOfKey('section:' + section.id) < 0) {
            return undefined;
        }
        return () => {
            setSectionOpen(section, true);
            listView?.nativeView?.scrollToIndex(indexOfKey('section:' + section.id), true);
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
                            await shareItem(item, event.object, VerticalPosition.BELOW);
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
        <collectionview bind:this={listView} {itemTemplateSelector} items={listItems} paddingBottom={16 + (__ANDROID__ ? $windowInset.bottom : 0)} row={1} ios:contentInsetAdjustmentBehavior={2}>
            <Template key="hero">
                <gridlayout height={HERO_HEIGHT}>
                    <RouteHeroMap bind:this={heroMap} {item} />
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
                    <gridlayout backgroundColor={colorCard} borderRadius={CARD_RADIUS} height={ROUTE_LENS_CARD_HEIGHT}>
                        <RouteLensCard besideMap={false} {item} moreFor={sectionOf} />
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
