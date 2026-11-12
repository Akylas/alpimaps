<script lang="ts">
    // a route's own page: its tiles, its profile read through the lens, then one card per feature section.
    // One collectionview: a section is its header row and, while open, its body rows
    import { Color, type EventData, Font, FormattedString, type GridLayout, ImageSource, ObservableArray, Span } from '@nativescript/core';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import { showError } from '@shared/utils/showError';
    import { goBack, navigate } from '@shared/utils/svelte/ui';
    import RouteStatTiles from '~/components/bottomsheet/RouteStatTiles.svelte';
    import TripStrip from '~/routeFeatures/page/TripStrip.svelte';
    import { dayFormat, daysFrom, tripTimes } from '~/routeFeatures/page/trip';
    import WhenPanel from '~/routeFeatures/page/WhenPanel.svelte';
    import { departurePassed, fixedStart, offsetAtFor, resolveStart, snapshotOutdated, stampNow } from '~/utils/routeAnalysis/departure';
    import { withDeparture } from '~/utils/routeAnalysis/storage';
    import type { RouteAnalysis } from '~/utils/routeAnalysis/types';
    import { onDestroy, onMount, tick } from 'svelte';
    import { get } from 'svelte/store';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import type { CollectionView } from '@nativescript-community/ui-collectionview';
    import { formatTime, lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { Item } from '~/models/Item';
    import Chip from '~/components/common/Chip.svelte';
    import RouteLensCard from '~/routeFeatures/lens/RouteLensCard.svelte';
    import RouteHeroMap from '~/routeFeatures/page/RouteHeroMap.svelte';
    import { analysisChanged, keepLook, lookAt, revertLook, routeAnalysisChanges, saveAnalysis } from '~/routeFeatures/analysisRunner';
    import { focusKeyOf } from '~/routeFeatures/lens/routeFocusStore';
    import { focusLensSection } from '~/routeFeatures/lens/routeLensStore';
    import { type ListRow, type PageRow, type StoredSections, bodyRows, isSectionOpen, pageRows } from '~/routeFeatures/page/rows';
    import { type LensId, type LensSection, type RoutePageSection, endVisit, lazyComponents, routeFeatureChanges, routeFeatures, routePageSections, tellDeparture } from '~/routeFeatures/registry';
    import { ROUTE_LENS_CARD_HEIGHT } from '~/utils/navigation';
    import { shareItem } from '~/mapModules/itemActions';
    import { showPopoverMenu } from '~/utils/ui/index.common';
    import type { AppBar } from '@nativescript-community/ui-appbar';
    import type { MenuItem } from '@nativescript-community/ui-menu';
    import { syncList } from '~/utils/syncList';
    import { utcOffsetAt } from '~/utils/timezone';
    import { colors, fonts, screenWidthDips, windowInset } from '~/variables';

    export let item: Item;
    /** opened from the Time tile: the When panel shows */
    export let openWhen = false;

    $: ({
        colorCanvas,
        colorCard,
        colorErrorContainer,
        colorOnErrorContainer,
        colorOnSurface,
        colorOnSurfaceVariant,
        colorPrimary,
        colorPrimaryContainer,
        colorSurface,
        colorSurfaceFill
    } = $colors);

    // the lens bar, its insight line, the chart and the grade legend under it
    const SECTION_HEADER_HEIGHT = 56;
    const CARD_RADIUS = 16;

    // the hero map is not in the list, which would give its view away once off screen and build the map again: it stays over the list, which
    // starts with an empty row as high as it, and follows that row
    const HERO_HEIGHT = 240;
    let heroHolder: NativeViewElementNode<GridLayout>;
    // the list tells every scroll, the ones it makes by itself and its item animations too (`scrollOffset` is then where the content is drawn)
    function moveHero(offset: number) {
        if (heroHolder?.nativeView) {
            // the offset is exact while the empty row is on screen; once it is gone the list only estimates it from the rows it shows, and
            // the estimate can fall back under the height of the map: the map is hidden as long as its row is not there
            const rowShown = listView?.nativeView?.isItemAtIndexVisible(0) ?? true;
            heroHolder.nativeView.translateY = rowShown ? -Math.min(offset, HERO_HEIGHT) : -HERO_HEIGHT;
        }
    }
    const FAB_SIZE = 56;
    /** what the list leaves at its foot for the button: its size and the margin under it */
    const FAB_ROOM = FAB_SIZE + 16;
    /** scroll that tells a direction: a smaller move is a finger's jitter, which would flicker the button */
    const FAB_SCROLL_STEP = 24;
    // extended at the top and while the list is scrolled up, round while it is scrolled down
    let fabExpanded = true;
    let lastOffset = 0;
    function scrollListTo(index: number) {
        listView?.nativeView?.scrollToIndex(index, true);
    }
    // the times of the ride are the bar's subtitle once the strip that says them has scrolled away
    let tripHidden = false;
    function updateTripHidden(offset: number) {
        const index = indexOfKey('trip');
        const view = listView?.nativeView;
        tripHidden = index >= 0 && !!view && offset > 0 && !view.isItemAtIndexVisible(index);
    }
    function onListScroll(event: EventData) {
        // the event is typed for its base only
        const offset = 'scrollOffset' in event && typeof event.scrollOffset === 'number' ? event.scrollOffset : (listView?.nativeView?.scrollOffset ?? 0);
        moveHero(offset);
        updateTripHidden(offset);
        if (offset <= FAB_SCROLL_STEP) {
            fabExpanded = true;
            lastOffset = offset;
        } else if (offset > lastOffset + FAB_SCROLL_STEP) {
            fabExpanded = false;
            lastOffset = offset;
        } else if (offset < lastOffset - FAB_SCROLL_STEP) {
            fabExpanded = true;
            lastOffset = offset;
        }
    }
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

    // filled once, then changed where something changed: a new array would rebuild every row
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
        if (open) {
            sectionComponents.load(section.id, section.component);
        }
        const ctx = { item };
        const rows: ListRow[] = [
            { type: 'section', key: 'section:' + section.id, section, open, summary: section.summary?.(ctx), facts: section.facts?.(ctx), icon: section.iconOf?.(ctx) },
            ...(open ? bodyRows(section.id, section.rows(ctx)) : [])
        ];
        // the section is its header and the rows under it
        const bodyKey = section.id + ':';
        let length = 1;
        while (header + length < listItems.length && listItems.getItem(header + length).key.startsWith(bodyKey)) {
            length++;
        }
        syncList(listItems, header, length, rows, { key: (row) => row.key, same: sameRow });
    }
    function sameRow(shown: ListRow, next: ListRow) {
        if (shown.type === 'section' && next.type === 'section') {
            return shown.open === next.open && shown.summary === next.summary && shown.icon === next.icon && JSON.stringify(shown.facts) === JSON.stringify(next.facts);
        }
        // the card's last row rounds its bottom
        return shown.type === 'body' && next.type === 'body' && shown.last === next.last && JSON.stringify(shown.row.data) === JSON.stringify(next.row.data);
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

    // the departure: the button says it, the panel under the tiles sets it
    let whenOpen = openWhen;
    // the button opens the panel and brings it into view, where the list is scrolled to; with the panel in view already it closes it
    async function onWhenTap() {
        if (whenOpen && listView?.nativeView?.isItemAtIndexVisible(indexOfKey('when'))) {
            whenOpen = false;
            return;
        }
        whenOpen = true;
        // once the panel's row is in the list
        await tick();
        // from the map down: the panel is under the tiles, which are under it
        scrollListTo(indexOfKey('hero'));
    }
    function toggleWhen() {
        whenOpen = !whenOpen;
    }
    let now = Date.now();
    const clockTimer = setInterval(() => (now = Date.now()), 60000);
    onDestroy(() => clearInterval(clockTimer));
    // a departure looked at and not taken is not the route's
    onDestroy(giveBackLook);
    // what the sections had open, as the climbs' steep list, is not kept for the next route
    onDestroy(endVisit);
    // `>= 0` is always true: it reruns this when the analysis changed in place
    $: analysis = $routeAnalysisChanges >= 0 ? item?.analysis : null;
    $: departure = analysis?.inputs.departure ?? { mode: 'now' as const };
    $: trip = analysis ? tripTimes(item, now, utcOffsetAt) : null;
    $: arrivalAt = trip ? trip.end : item?.route?.totalTime ? resolveStart(departure, now) + item.route.totalTime * 1000 : NaN;
    // a plan that has gone by, or a now whose data is old: the banner offers to move it to the clock. "keep" keeps a plan at its own time, the
    // route read then; a now is only put away for this visit
    $: passed = departurePassed(departure, now) || snapshotOutdated(departure, now);
    let keptAt: number | undefined;
    function keepDeparture() {
        if (departure.mode === 'planned') {
            onAnalysisChange({ analysis: withDeparture(item.analysis, item.geometry, { ...departure, keepPast: true }) });
            // the route is read at another time now: what a feature needs for it, it asks for
            tellDeparture($routeFeatures, { item }, 'taken');
            return;
        }
        keptAt = departure.at;
    }
    $: departureGone = passed && departure.at !== keptAt;
    $: setRow({ type: 'passed', key: 'passed' }, departureGone, 'hero');
    // the list keeps the panel's view while it is closed: the panel is told each time it is opened
    let whenOpened = 0;
    $: if (whenOpen) {
        whenOpened++;
    }
    $: setRow({ type: 'when', key: 'when', opened: whenOpened }, whenOpen, indexOfKey('trip') >= 0 ? 'trip' : 'tiles');
    $: offsetAt = offsetAtFor(departure, utcOffsetAt);
    function clock(at: number) {
        return formatTime(at, 'LT', offsetAt(at));
    }
    // a departure that is not today says its day: the weekday ahead, the date for a day gone
    function dayAndClock(at: number) {
        const day = dayFormat(daysFrom(at, now, offsetAt));
        return `${day ? formatTime(at, day, offsetAt(at)) + ' ' : ''}${clock(at)}`;
    }
    $: whenLabel = `${fixedStart(departure) !== undefined ? dayAndClock(fixedStart(departure)) : lc('now')}${isNaN(arrivalAt) ? '' : ' → ' + clock(arrivalAt)}`;

    // the times change in place: what shows them follows the analysis' changes. The activity changes what the whole page reads.
    // A departure looked at in the When panel: the page shows the route as it would be, and the runner keeps what the item had to give
    // back. Nothing of it is saved until the departure is taken
    function onAnalysisChange({ analysis, full, preview }: { analysis: RouteAnalysis; full?: boolean; preview?: boolean }) {
        if (preview) {
            lookAt(item, analysis);
        } else {
            keepLook(item);
            item.analysis = analysis;
            saveAnalysis(item, analysis);
        }
        analysisChanged();
        if (full) {
            item = item;
        }
    }
    function giveBackLook() {
        revertLook(item);
    }
    // an unsaved route keeps its analysis on the item until it is saved with it
    function isSaved(route: Item) {
        return route?.id !== undefined && route.id !== null;
    }
    function departNow() {
        onAnalysisChange({ analysis: withDeparture(item.analysis, item.geometry, stampNow({ mode: 'now' }, Date.now())) });
        // the data that is read at a time is read again
        tellDeparture($routeFeatures, { item }, 'restamped');
    }

    // a body is its section's own component: one template for each, whose views are only reused by rows of the same section
    function itemTemplateSelector(row: ListRow) {
        return row.type === 'body' ? `body:${row.section}` : row.type;
    }
    // what a section's header shows of its facts: the slots its template has, which keeps its structure the same for every section
    const FACT_SLOTS = [0, 1, 2, 3, 4, 5, 6];

    // the insight line's `›` on this page: the lens' own section, opened and brought into view
    let listView: NativeViewElementNode<CollectionView>;
    function sectionOf(lens: LensId) {
        const section = sections.find((candidate) => candidate.lens === lens);
        if (!section || indexOfKey('section:' + section.id) < 0) {
            return undefined;
        }
        return () => {
            setSectionOpen(section, true);
            scrollListTo(indexOfKey('section:' + section.id));
        };
    }

    // a row of a section asks to focus a stretch of the route: it is read in the section's lens
    function focusOn(section: RoutePageSection, lensSection: LensSection) {
        if (!lensSection || !section.lens) {
            return;
        }
        focusLensSection(focusKeyOf(item), section.lens, lensSection);
    }

    function bodyProps(row: PageRow) {
        return row.type === 'body' && row.row.data !== undefined ? { data: row.row.data } : {};
    }

    // a font icon for the bar and its menu, drawn from a span
    function mdiIcon(glyph: string) {
        const span = new Span();
        span.text = glyph;
        span.fontFamily = $fonts.mdi;
        span.fontSize = 24;
        const icon = new FormattedString();
        icon.spans.push(span);
        return icon;
    }
    // the clock of the departure button, as an image: the button has no font icon
    $: clockIcon = ImageSource.fromFontIconCodeSync('mdi-clock-outline', Font.default.withFontFamily($fonts.mdi).withFontSize(24), new Color('white'));

    // svelte-native does not type the nested android.* properties
    const navigationIcon = { 'android.systemIcon': 'ic_menu_back' };
    let appBar: NativeViewElementNode<AppBar>;
    // the bar follows the list
    onMount(() => {
        appBar.nativeView.scrollTarget = listView.nativeView;
    });
    let menu: MenuItem[];
    $: menu = [
        { title: lc('show_on_map'), icon: mdiIcon('mdi-map-outline'), onSelect: showOnMap },
        { title: lc('share'), icon: mdiIcon('mdi-share-variant'), onSelect: () => shareItem(item, appBar?.nativeView, VerticalPosition.BELOW) },
        ...(isSaved(item) ? [{ title: lc('edit'), icon: mdiIcon('mdi-pencil'), onSelect: editItem }] : [])
    ];

    // the item's own form: its name, colour and style
    async function editItem() {
        try {
            const ItemEdit = (await import('~/components/items/ItemEdit.svelte')).default;
            navigate({ page: ItemEdit, props: { item } });
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

<appPage backgroundColor={colorCanvas}>
    <appBar bind:this={appBar} scrollBehavior="lift">
        <navigationButton {...navigationIcon} on:tap={() => goBack()} />
        <!-- the title on two lines, which the bar's own title does not do -->
        <stacklayout verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={15} fontWeight="bold" lineBreak="end" maxLines={2} text={title || ''} />
            <label
                color={colorOnSurfaceVariant}
                fontSize={11.5}
                lineBreak="end"
                maxLines={1}
                text={(tripHidden && !isNaN(arrivalAt) ? whenLabel : subtitle) || ''}
                visibility={(tripHidden && !isNaN(arrivalAt)) || subtitle ? 'visible' : 'collapse'} />
        </stacklayout>
        <appBarItem android.position="actionBar" icon={mdiIcon('mdi-dots-vertical')} ios.position="right" {menu} text={lc('more')} />
    </appBar>
    <gridlayout>
        <collectionview
            bind:this={listView}
            {itemTemplateSelector}
            items={listItems}
            paddingBottom={16 + FAB_ROOM + (__ANDROID__ ? $windowInset.bottom : 0)}
            ios:contentInsetAdjustmentBehavior={2}
            on:scroll={onListScroll}>
            <!-- as high as the map over it, which follows it -->
            <Template key="hero">
                <gridlayout height={HERO_HEIGHT} />
            </Template>
            <Template key="passed">
                <gridlayout backgroundColor={colorCanvas} padding="8 6 0 6">
                    <gridlayout backgroundColor={colorErrorContainer} borderRadius={CARD_RADIUS} columns="*,auto,auto" padding="8 12">
                        <label
                            color={colorOnErrorContainer}
                            fontSize={13}
                            text={departure.mode === 'planned' ? lc('when_departure_passed', dayAndClock(departure.at)) : lc('when_snapshot_old', dayAndClock(departure.at))}
                            textWrap={true}
                            verticalAlignment="middle" />
                        <mdbutton col={1} text={lc('when_use_now')} variant="text" verticalAlignment="middle" on:tap={departNow} />
                        <mdbutton col={2} text={lc('when_keep')} variant="text" verticalAlignment="middle" on:tap={keepDeparture} />
                    </gridlayout>
                </gridlayout>
            </Template>
            <Template key="when" let:item={row}>
                <gridlayout backgroundColor={colorCanvas} padding="8 6 0 6">
                    <gridlayout backgroundColor={colorCard} borderRadius={CARD_RADIUS}>
                        <WhenPanel {item} opened={row.opened ?? 0} on:change={onAnalysisChange} on:revert={giveBackLook} />
                    </gridlayout>
                </gridlayout>
            </Template>
            <Template key="tiles">
                <!-- the tiles keep their own 40 high: the row around them does not follow what they show -->
                <gridlayout backgroundColor={colorCanvas} height={48} paddingTop={8}>
                    <RouteStatTiles {item} sheetWidth={screenWidthDips} on:when={toggleWhen} />
                </gridlayout>
            </Template>
            <Template key="trip">
                <gridlayout backgroundColor={colorCanvas} padding="8 6 0 6">
                    <gridlayout backgroundColor={colorCard} borderRadius={CARD_RADIUS}>
                        <TripStrip {item} on:when={toggleWhen} />
                    </gridlayout>
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
                            text={row.icon ?? row.section.icon}
                            textAlignment="center"
                            verticalTextAlignment="middle"
                            width={36} />
                        <stacklayout col={1} paddingLeft={12} verticalAlignment="middle">
                            <label color={colorOnSurface} fontSize={14.5} fontWeight="bold" text={row.section.title()} />
                            <!-- the summary as chips: an icon and its figure, in their colours, open or not: the rows under it do not say it again.
                                 A template keeps its views whatever the row: the chips are slots, collapsed when empty, and so is the summary line.
                                 They wrap onto a line of their own when there are more than fit: none is cut off -->
                            <wraplayout visibility={row.facts?.length ? 'visible' : 'collapse'}>
                                {#each FACT_SLOTS as slot}
                                    <Chip
                                        alert={row.facts?.[slot]?.alert ?? false}
                                        bar={row.facts?.[slot]?.bar ?? null}
                                        color={row.facts?.[slot]?.color}
                                        height={20}
                                        icon={row.facts?.[slot]?.icon}
                                        label={row.facts?.[slot]?.label}
                                        marginTop={2}
                                        note={row.facts?.[slot]?.note}
                                        text={row.facts?.[slot]?.text}
                                        tint={row.facts?.[slot]?.tint}
                                        unit={row.facts?.[slot]?.unit}
                                        value={row.facts?.[slot]?.value}
                                        visibility={row.facts?.[slot] ? 'visible' : 'collapse'} />
                                {/each}
                            </wraplayout>
                            <label
                                color={colorOnSurfaceVariant}
                                fontSize={12}
                                lineBreak="end"
                                maxLines={1}
                                text={row.summary || ''}
                                visibility={row.summary && !row.facts?.length ? 'visible' : 'collapse'} />
                        </stacklayout>
                        <label col={2} color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={22} text={row.open ? 'mdi-chevron-up' : 'mdi-chevron-down'} verticalAlignment="middle" />
                    </gridlayout>
                </gridlayout>
            </Template>
            {#each sections as section (section.id)}
                <Template key={`body:${section.id}`} let:item={row}>
                    <gridlayout backgroundColor={colorCanvas} padding="0 6">
                        <gridlayout backgroundColor={colorCard} borderRadius={row.last ? `0 0 ${CARD_RADIUS} ${CARD_RADIUS}` : 0} height={row.row.height ?? 'auto'} paddingBottom={row.last ? 8 : 0}>
                            <!-- nothing until the section's component is loaded -->
                            <svelte:component this={$sectionComponents[section.id]} {item} {...bodyProps(row)} on:focus={(lensSection) => focusOn(section, lensSection)} />
                        </gridlayout>
                    </gridlayout>
                </Template>
            {/each}
            <Template key="footer">
                <label backgroundColor={colorCanvas} color={colorOnSurfaceVariant} fontSize={11} padding="16 16 0 16" text={lc('route_page_attribution')} textAlignment="center" />
            </Template>
        </collectionview>
        <!-- over the list, which leaves room for it at its top: the map stays, the list's rows scroll under it -->
        <gridlayout bind:this={heroHolder} height={HERO_HEIGHT} verticalAlignment="top">
            <RouteHeroMap bind:this={heroMap} {item} />
            <stacklayout horizontalAlignment="right" padding={8} verticalAlignment="top">
                <mdbutton class="small-floating-btn" backgroundColor={colorSurface} color={colorOnSurface} text="mdi-arrow-expand" on:tap={showOnMap} />
                <!-- the whole route again, after a section or a point was looked at -->
                <mdbutton class="small-floating-btn" backgroundColor={colorSurface} color={colorOnSurface} marginTop={8} text="mdi-fit-to-screen-outline" on:tap={() => heroMap?.showWholeRoute()} />
            </stacklayout>
        </gridlayout>
    </gridlayout>
    <appPageOverlay>
        <!-- the departure: an extended button over the list, a round one once the list is scrolled down, as it is read -->
        <floatingactionbutton
            backgroundColor={passed ? colorErrorContainer : colorPrimaryContainer}
            color={passed ? colorOnErrorContainer : colorOnSurface}
            expanded={fabExpanded}
            horizontalAlignment="right"
            margin={`0 16 ${16 + (__ANDROID__ ? $windowInset.bottom : 0)} 0`}
            rippleColor={colorPrimary}
            src={clockIcon}
            text={whenLabel}
            verticalAlignment="bottom"
            on:tap={onWhenTap}
            on:longPress={departNow} />
    </appPageOverlay>
</appPage>
