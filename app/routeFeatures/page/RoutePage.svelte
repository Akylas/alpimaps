<script lang="ts">
    // a route's own page: its tiles, its profile read through the lens, then one card per feature section.
    // One collectionview: a section is its header row and, while open, its body rows
    import { Template } from '@nativescript-community/svelte-native/components';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import CActionBar from '@shared/components/CActionBar.svelte';
    import { showError } from '@shared/utils/showError';
    import { goBack, navigate } from '@shared/utils/svelte/ui';
    import RouteStatTiles from '~/components/bottomsheet/RouteStatTiles.svelte';
    import { lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { Item } from '~/models/Item';
    import RouteLensCard from '~/routeFeatures/lens/RouteLensCard.svelte';
    import { focusKeyOf, focusSection } from '~/routeFeatures/lens/routeFocusStore';
    import { selectLens } from '~/routeFeatures/lens/routeLensStore';
    import { type PageRow, type StoredSections, pageRows, toggledSections } from '~/routeFeatures/page/rows';
    import { type LensSection, type RoutePageSection, lazyComponents, routeFeatureChanges, routeFeatures, routePageSections } from '~/routeFeatures/registry';
    import { packageService } from '~/services/PackageService';
    import { computeRouteProgress, isLocationOnRoute, isNavigableRoute } from '~/utils/navigation';
    import { showPopoverMenu } from '~/utils/ui/index.common';
    import { colors, fonts, screenWidthDips, windowInset } from '~/variables';

    export let item: Item;

    let { colorCanvas, colorCard, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors;
    $: ({ colorCanvas, colorCard, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors);

    // the lens bar, its insight line, the chart and the grade legend under it
    const PROFILE_HEIGHT = 44 + 40 + 150 + 24;
    const SECTION_HEADER_HEIGHT = 56;
    const CARD_RADIUS = 16;

    const mapContext = getMapContext();
    const sectionComponents = lazyComponents();

    $: title = formatter.getItemTitle(item);
    $: subtitle = formatter.getItemSubtitle(item, title);

    $: sections = $routeFeatureChanges >= 0 ? routePageSections($routeFeatures) : [];
    // what the user opened, for this visit only: the page always opens on its tiles and profile
    let stored: StoredSections = {};
    $: rows = $routeFeatureChanges >= 0 ? pageRows({ sections, ctx: { item }, stored, hasProfile: !!item?.profile?.data?.length }) : [];
    $: rows.forEach((row) => row.type === 'section' && row.open && sectionComponents.load(row.section.id, row.section.component));
    $: sectionsById = Object.fromEntries(sections.map((section) => [section.id, section]));

    function itemTemplateSelector(row: PageRow) {
        return row.type;
    }

    function toggleSection(section: RoutePageSection) {
        stored = toggledSections(stored, section);
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
                ...(item.id !== undefined ? [{ id: 'edit', icon: 'mdi-pencil', name: lc('edit') }] : [])
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

    function showOnMap() {
        goBack();
        mapContext.selectItem({ item, isFeatureInteresting: true });
    }
</script>

<page actionBarHidden={true}>
    <gridlayout backgroundColor={colorCanvas} rows="auto,*">
        <CActionBar canGoBack title={null}>
            <stacklayout slot="center" col={1} verticalAlignment="middle">
                <label color={colorOnSurface} fontSize={15.5} fontWeight="bold" lineBreak="end" maxLines={1} text={title || ''} />
                <label color={colorOnSurfaceVariant} fontSize={11.5} lineBreak="end" maxLines={1} text={subtitle || ''} visibility={subtitle ? 'visible' : 'collapse'} />
            </stacklayout>
            <mdbutton class="actionBarButton" text="mdi-dots-vertical" variant="text" on:tap={showMenu} />
        </CActionBar>
        <collectionview {itemTemplateSelector} items={rows} paddingBottom={16 + (__ANDROID__ ? $windowInset.bottom : 0)} row={1} ios:contentInsetAdjustmentBehavior={2}>
            <Template key="tiles">
                <!-- the tiles keep their own 40 high: the row around them does not follow what they show -->
                <gridlayout height={48} paddingTop={8}>
                    <RouteStatTiles {item} sheetWidth={screenWidthDips} />
                </gridlayout>
            </Template>
            <Template key="profile">
                <gridlayout backgroundColor={colorCard} borderRadius={CARD_RADIUS} height={PROFILE_HEIGHT} margin="8 6 0 6">
                    <RouteLensCard bind:this={lensCard} besideMap={false} {item} on:highlight={onChartHighlight} />
                </gridlayout>
            </Template>
            <Template key="section" let:item={row}>
                <gridlayout
                    backgroundColor={colorCard}
                    borderRadius={row.open ? `${CARD_RADIUS} ${CARD_RADIUS} 0 0` : CARD_RADIUS}
                    columns="36,*,auto"
                    height={SECTION_HEADER_HEIGHT}
                    margin="8 6 0 6"
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
            </Template>
            <Template key="body" let:item={row}>
                <gridlayout
                    backgroundColor={colorCard}
                    borderRadius={row.last ? `0 0 ${CARD_RADIUS} ${CARD_RADIUS}` : 0}
                    height={row.row.height ?? 'auto'}
                    margin="0 6"
                    paddingBottom={row.last ? 8 : 0}>
                    {#if $sectionComponents[row.section]}
                        <svelte:component this={$sectionComponents[row.section]} {item} {...bodyProps(row)} on:focus={(section) => focusOn(row.section, section)} />
                    {/if}
                </gridlayout>
            </Template>
            <Template key="footer">
                <label color={colorOnSurfaceVariant} fontSize={11} padding="16 16 0 16" text={lc('route_page_attribution')} textAlignment="center" />
            </Template>
        </collectionview>
    </gridlayout>
</page>
