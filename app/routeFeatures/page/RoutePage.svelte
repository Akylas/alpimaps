<script lang="ts">
    // a route's own page: its tiles, its profile read through the lens, then one card per feature section.
    // One collectionview: a section is its header row and, while open, its body rows
    import { Color, type EventData, Font, FormattedString, type GridLayout, ImageSource, ObservableArray, Span } from '@nativescript/core';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import { showError } from '@shared/utils/showError';
    import { goBack, navigate } from '@shared/utils/svelte/ui';
    import RouteStatTiles from '~/components/bottomsheet/RouteStatTiles.svelte';
    import WhenPanel from '~/routeFeatures/page/WhenPanel.svelte';
    import { departurePassed, resolveStart, routeTimeZone } from '~/utils/routeAnalysis/departure';
    import { withDeparture } from '~/utils/routeAnalysis/storage';
    import { buildTimeline, timelineSource } from '~/utils/routeAnalysis/timeline';
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
    import { isEInk } from '~/helpers/theme';
    import RouteLensCard from '~/routeFeatures/lens/RouteLensCard.svelte';
    import RouteHeroMap from '~/routeFeatures/page/RouteHeroMap.svelte';
    import { analysisChanged, keepLook, lookAt, lookingBase, revertLook, routeAnalysisChanges, saveAnalysis } from '~/routeFeatures/analysisRunner';
    import { focusKeyOf, focusSection } from '~/routeFeatures/lens/routeFocusStore';
    import { selectLens } from '~/routeFeatures/lens/routeLensStore';
    import { type ListRow, type PageRow, type StoredSections, bodyRows, isSectionOpen, pageRows } from '~/routeFeatures/page/rows';
    import { type LensId, type LensSection, type RoutePageSection, lazyComponents, routeFeatureChanges, routeFeatures, routePageSections } from '~/routeFeatures/registry';
    import { ROUTE_LENS_CARD_HEIGHT } from '~/utils/navigation';
    import { shareItem } from '~/mapModules/itemActions';
    import { showPopoverMenu } from '~/utils/ui/index.common';
    import type { AppBar } from '@nativescript-community/ui-appbar';
    import type { MenuItem } from '@nativescript-community/ui-menu';
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
    function onListScroll(event: EventData) {
        // the event is typed for its base only
        const offset = 'scrollOffset' in event && typeof event.scrollOffset === 'number' ? event.scrollOffset : (listView?.nativeView?.scrollOffset ?? 0);
        moveHero(offset);
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
        const current = listItems.getItem(header);
        const summary = section.summary?.({ item });
        const facts = section.facts?.({ item });
        const icon = section.iconOf?.({ item });
        if (current.type !== 'section' || current.open !== open || current.summary !== summary || current.icon !== icon || JSON.stringify(current.facts) !== JSON.stringify(facts)) {
            listItems.setItem(header, { type: 'section', key: 'section:' + section.id, section, open, summary, facts, icon });
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
    let now = Date.now();
    const clockTimer = setInterval(() => (now = Date.now()), 60000);
    onDestroy(() => clearInterval(clockTimer));
    // a departure looked at and not taken is not the route's
    onDestroy(giveBackLook);
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
    // the list keeps the panel's view while it is closed: the panel is told each time it is opened
    let whenOpened = 0;
    let wasWhenOpen = false;
    $: if (whenOpen !== wasWhenOpen) {
        wasWhenOpen = whenOpen;
        if (whenOpen) {
            whenOpened++;
        }
    }
    $: setRow({ type: 'when', key: 'when', version: analysisVersion, opened: whenOpened }, whenOpen, 'tiles');
    // the tiles and the When panel are drawn by templates, which do not follow what the page changes: what they show of the analysis is in
    // their items, set again with each change of it
    function refreshAnalysisRows(version: number, look: { analysis: RouteAnalysis | null } | undefined, _tick: number) {
        ['tiles', 'when'].forEach((key) => {
            const index = indexOfKey(key);
            if (index >= 0) {
                const row = listItems.getItem(index);
                if (row.type === 'when') {
                    listItems.setItem(index, { ...row, version, committed: look ? look.analysis : undefined });
                } else if (row.type === 'tiles') {
                    listItems.setItem(index, { ...row, version });
                }
            }
        });
    }
    $: refreshAnalysisRows(analysisVersion, committed, $routeAnalysisChanges);
    $: zone = routeTimeZone(departure);
    function clock(at: number) {
        return formatTime(at, 'LT', zone.offset);
    }
    $: whenLabel = `${departure.mode === 'planned' ? clock(departure.at) : lc('now')}${isNaN(arrivalAt) ? '' : ' → ' + clock(arrivalAt)}`;

    // the times change in place: only what shows them follows. The activity changes what the whole page reads
    let analysisVersion = 0;
    // a departure looked at in the When panel: the page shows the route as it would be, and the runner keeps what the item had to give
    // back. Nothing of it is saved until the departure is taken
    $: committed = analysisVersion >= 0 && $routeAnalysisChanges >= 0 ? lookingBase(item) : undefined;
    function onAnalysisChange({ analysis, full, preview }: { analysis: RouteAnalysis; full?: boolean; preview?: boolean }) {
        if (preview) {
            lookAt(item, analysis);
        } else {
            keepLook(item);
            item.analysis = analysis;
            saveAnalysis(item, analysis);
        }
        analysisVersion++;
        analysisChanged();
        if (full) {
            item = item;
        }
    }
    function giveBackLook() {
        revertLook(item);
        analysisVersion++;
    }
    // an unsaved route keeps its analysis on the item until it is saved with it
    function isSaved(route: Item) {
        return route?.id !== undefined && route.id !== null;
    }
    function departNow() {
        onAnalysisChange({ analysis: withDeparture(item.analysis, item.geometry, { mode: 'now' }) });
    }
    $: sectionsById = Object.fromEntries(sections.map((section) => [section.id, section]));

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
            <label color={colorOnSurfaceVariant} fontSize={11.5} lineBreak="end" maxLines={1} text={subtitle || ''} visibility={subtitle ? 'visible' : 'collapse'} />
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
                            text={lc('when_departure_passed', departure.mode === 'planned' ? clock(departure.at) : '')}
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
                        <WhenPanel committed={row.committed} {item} opened={row.opened ?? 0} version={row.version ?? 0} on:change={onAnalysisChange} on:revert={giveBackLook} />
                    </gridlayout>
                </gridlayout>
            </Template>
            <Template key="tiles" let:item={row}>
                <!-- the tiles keep their own 40 high: the row around them does not follow what they show -->
                <gridlayout backgroundColor={colorCanvas} height={48} paddingTop={8}>
                    <RouteStatTiles {item} sheetWidth={screenWidthDips} version={row.version ?? 0} on:when={() => (whenOpen = !whenOpen)} />
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
                                 A template keeps its views whatever the row: the chips are slots, collapsed when empty, and so is the summary line -->
                            <stacklayout orientation="horizontal" visibility={row.facts?.length ? 'visible' : 'collapse'}>
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
                            </stacklayout>
                            <label color={colorOnSurfaceVariant} fontSize={12} lineBreak="end" maxLines={1} text={row.summary || ''} visibility={row.summary && !row.facts?.length ? 'visible' : 'collapse'} />
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
                            <svelte:component this={$sectionComponents[section.id]} {item} {...bodyProps(row)} on:focus={(lensSection) => focusOn(section.id, lensSection)} />
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
