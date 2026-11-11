import type { Canvas } from '@nativescript-community/ui-canvas';
import type { Feature } from 'geojson';
import type { ComponentType } from 'svelte';
import { type Readable, derived, writable } from 'svelte/store';
import type { SettingsStore } from '~/stores/settingsStore';
import type { IItem } from '~/models/Item';
import type { AnalysisStage } from '~/utils/routeAnalysis/pipeline';
import type { RouteAnalysis } from '~/utils/routeAnalysis/types';

/** What every contribution is asked about. */
export interface RouteCtx {
    item: IItem;
    /** Navigating a leg that takes the user back to the route: the position is not on `item`, so what is read off its indexes is wrong. */
    detour?: boolean;
}

/** A compact stat of the sheet's header. */
export interface RouteTile {
    key: string;
    icon: string;
    /** Spoken by the long press tooltip. */
    label: string;
    value: string;
    /** A smaller line under the value; a selected point's remaining figure takes its place. */
    sub?: { icon: string; text: string };
    /** The share of the row's width, 1 when missing. */
    weight?: number;
    /** A tap on the tile reads the route in this lens, when the route has it. */
    lens?: LensId;
    /** A tap on the tile opens the route page on its When panel. */
    opensWhen?: boolean;
    /** The figure is a warning: the tile is outlined in the error colour. */
    alert?: boolean;
}

/**
 * A card of the item sheet, given its layout props and `item`. It may export `highlightPathIndex` and `reload`
 * for the sheet to call, with the user's position on the route.
 */
export interface RouteSheetCard {
    /** Loaded the first time the card has a height, so its code stays out of the startup graph. */
    component: () => Promise<{ default: ComponentType }>;
    /** dp the card takes, the gap above it included. 0: nothing to show, so no step. */
    height: (ctx: RouteCtx, gap: number) => number;
    /** The sheet works out the user's progress along the route, for a card that shows it. */
    followsPosition?: boolean;
    /** Runs whenever the item, the layout or the sheet's step change; `shown`: the sheet has reached the card. */
    watch?: (ctx: RouteCtx & { shown: boolean }) => void;
}

export interface RouteSheetCardLayout {
    id: string;
    card: RouteSheetCard;
    height: number;
}

export type LensId = 'overview' | 'climbs' | 'road' | 'weather' | 'sun' | 'surface';

/** The lens bar's fixed order, whatever the order the features register in. */
export const LENS_ORDER: LensId[] = ['overview', 'climbs', 'road', 'weather', 'sun', 'surface'];

/** What a lens shows on its chip, next to its label. */
export interface LensChip {
    /** The lens' headline figure; none for a lens that has none. */
    value?: string;
    /** The lens has something serious to look at: a dot on the chip. */
    alert?: boolean;
    /** Absent: the data is there and fresh. */
    state?: 'missing' | 'running' | 'outdated' | 'offline';
}

/** One figure of a lens' headline: an icon and what it says. */
export interface LensFact {
    icon?: string;
    text: string;
    /** The figure and its unit apart, a lighter unit after a bold figure: when there, they are shown in place of `text` */
    value?: string;
    unit?: string;
    /** Before the figure, in the lighter type */
    label?: string;
    /** After the unit, lighter still */
    note?: string;
    /** The chip's wash, when it says how much there is of what it is about */
    tint?: string;
    /** 0..1: a thin bar under the figure */
    bar?: number;
    /** The icon's colour, eg the surface it stands for. */
    color?: string;
    /** The figure is a warning: the icon takes the error colour. */
    alert?: boolean;
}

/** The line under the lens bar: a few facts, with the button that goes with them when it asks for something. */
export interface LensHeadline {
    facts: LensFact[];
    action?: { label: string; run: () => void };
}

/** What needs attention along the route, whatever the lens: marked under the profile. */
export type AttentionKind = 'steep' | 'fast';

export interface AttentionMark {
    kind: AttentionKind;
    /** The mark's colour on a colour display, the feature's own. */
    color: string;
    /** The lens and section a tap on the mark goes to. */
    lens: LensId;
    section: LensSection;
}

/** An attention mark on the chart, meters from the start. */
export interface ProfileMark {
    from: number;
    to: number;
    kind: AttentionKind;
    color: string;
}

/** A span of the profile marked above the curve, eg a climb with its category. Meters from the start. */
export interface ProfileBracket {
    from: number;
    to: number;
    /** The elevation it stands over, m. */
    top: number;
    label?: string;
}

/** A stretch of the route a lens speaks of, eg a climb: it can be focused. `i0`..`i1` are profile data indexes. */
export interface LensSection {
    id: number;
    i0: number;
    i1: number;
    /** What the insight row says while it is focused. */
    title: string;
}

/** A stretch of the route drawn in the lens' look: `k` picks the look, `s` how serious it is, 0 to 3. */
export interface LensSlice {
    i0: number;
    i1: number;
    k: number | string;
    s: 0 | 1 | 2 | 3;
}

/** What a symbol of a lens looks like on the map: the style has a drawing for each. */
export type LensSymbolShape = 'plate' | 'marker' | 'speed_sign' | 'grade_label' | 'climb_label' | 'climb_label_tip';

/**
 * A symbol on the route at a vertex: a glyph with its figures on a plate, a speed sign, a climb's category. The style draws it
 * by its `shape`, from these fields alone, so what a feature puts on the map is its own to say.
 */
export interface LensSymbol {
    shape: LensSymbolShape;
    /** The route vertex it stands at. */
    vertex: number;
    /** The main figure or word. */
    label: string;
    /** A smaller line after the label. */
    sublabel?: string;
    /** What is worth a line of its own under the rest, starting with a newline. */
    note?: string;
    /** A glyph of the icon font. */
    glyph?: string;
    /** Degrees, for an arrow. */
    rotation?: number;
    /** How serious it is, 0 to 3: the style sizes by it. */
    severity: 0 | 1 | 2 | 3;
    /** The key of the palette the accent colour of the symbol is: a rim, a tint. The style has none of its own. */
    tint?: string;
    /** The data it shows is out of date. */
    outdated?: 0 | 1;
    /** Where the placement of the symbols goes first: the higher wins the place. */
    priority: number;
}

/** A stretch to watch while following the route, whatever the lens. `i0`..`i1` are route vertex indexes. */
export interface NavAlert {
    kind: 'fast' | 'steep';
    i0: number;
    i1: number;
    s: 2 | 3;
}

/** A colour the profile fill takes from this data index on. */
export interface ProfileFillStop {
    d: number;
    color: string;
    /** What it is on e-ink, where colour is lost: how dark, 0 to 255, as a grade is. The grade's own when missing. */
    shade?: number;
}

/** Where the chart puts its plot and how a distance or an elevation turns into a pixel of it, handed to what a feature draws over it. */
export interface ProfileView {
    contentLeft: number;
    contentRight: number;
    contentTop: number;
    contentBottom: number;
    pixelX: (distance: number) => number;
    pixelY: (elevation: number) => number;
    fontScale: number;
    isEInk: boolean;
    /** The colours of the theme: text, and the ground it is read on. */
    ink: string;
    background: string;
    /** The family of the icon font, for a glyph. */
    iconFontFamily: string;
}

/** What a feature draws over the profile, after its fill, in the plot: it makes the chart extendable. */
export interface ProfileOverlay {
    draw(canvas: Canvas, view: ProfileView): void;
}

/** One entry of the line under the profile that says what its colours mean. */
export interface ProfileLegendEntry {
    label: string;
    color: string;
    /** the swatch on e-ink, where colour is lost; the colour's when missing */
    eink?: string;
}

/** What a lens asks of the profile chart. */
export interface LensProfile {
    /** What the fill's colours mean, in the line under the chart: the grade legend is there when none. */
    legend?: ProfileLegendEntry[];
    brackets?: ProfileBracket[];
    /** The grade fill steps back, for what the lens lays over it to read. */
    fade?: boolean;
    /** What the lens draws over the plot. */
    overlay?: ProfileOverlay;
    /** The fill's colours, when they are not the grade's. */
    fill?: ProfileFillStop[];
}

/** One way of reading the route: it colours the line and fills the profile, see `routeLensStore`. */
/** One line of a lens' legend: a swatch and what it says. */
export interface LensLegendItem {
    id: string;
    label: string;
    kind: 'line' | 'shield';
    lines?: { color: string; width: number; dasharray?: number[] }[];
    plate?: { color: string; radius?: number; border?: string; borderWidth?: number };
    text?: { value: string; color: string };
}

export interface LensLegendSection {
    id: 'route_lens';
    label: string;
    items: LensLegendItem[];
}

/** The colours of the lens slices and symbols, by the keys the style looks them up with. Each feature names its own. */
export type LensPaletteVariant = 'light' | 'dark' | 'eink';
export type LensPaletteContribution = (variant: LensPaletteVariant) => Record<string, string>;

/** What a lens' legend is made from. */
export interface LensLegendContext {
    item: IItem;
    variant: LensPaletteVariant;
    /** Every key of the style's palette, as the map draws them. */
    palette: Record<string, string>;
    translate: (key: string) => string;
}

export interface RouteLens {
    id: LensId;
    icon: string;
    label: () => string;
    /** A lens a route cannot show is not in the bar. */
    available: (ctx: RouteCtx) => boolean;
    chip: (ctx: RouteCtx) => LensChip;
    headline: (ctx: RouteCtx) => LensHeadline;
    /** What the lens says of the route vertex under the cursor, next to the figures every lens shows. */
    readout?: (ctx: RouteCtx & { index: number }) => string | undefined;
    profile?: (ctx: RouteCtx) => LensProfile;
    /** The stretches to focus, in route order. */
    sections?: (ctx: RouteCtx) => LensSection[];
    /** Opens the lens' own section, when there is one for this route: the insight row's `›` runs it. */
    openSection?: (ctx: RouteCtx) => (() => void | Promise<void>) | undefined;
    /** What the map line is cut into. None: the line keeps the item's look. */
    slices?: (ctx: RouteCtx) => LensSlice[];
    /** The plates on the map line, with the slices. */
    symbols?: (ctx: RouteCtx) => LensSymbol[];
    /** Reads the lens' data again, from its long press menu. None: nothing to refresh. */
    refresh?: (ctx: RouteCtx) => void | Promise<void>;
    /** What the colours and symbols of the lens mean, for the map's legend. None: nothing the legend could explain. */
    legend?: (ctx: LensLegendContext) => LensLegendSection | null;
}

/** A card of the navigation sheet, under the actions: it gets `item` and its card look. */
export interface RouteNavSection {
    id: string;
    /** Loaded the first time the section has a height, the navigation ui is not part of the startup graph. */
    component: () => Promise<{ default: ComponentType }>;
    /** dp at the navigation scale. 0: nothing to show, so no row. */
    height: (scale: number, ctx: RouteCtx) => number;
}

export interface RouteNavSectionLayout {
    id: string;
    section: RouteNavSection;
    height: number;
}

/**
 * A page of the navigation dock: the one the user swipes to, under the summary. The component gets its `height` and
 * draws its own title line; the user's setting `navigationPages` says which pages are shown and in what order.
 */
export interface RouteNavPage {
    /** Stable: it is what the setting and the remembered page hold. */
    id: string;
    /** In the settings list. */
    label: () => string;
    /** Loaded the first time the page is shown, the navigation ui is not part of the startup graph. */
    component: () => Promise<{ default: ComponentType }>;
    /** False: the route has nothing for this page, so it is not in the dots. */
    available: (ctx: RouteCtx) => boolean;
}

/** A card floating over the map under the maneuver card while navigating: it hides itself when it has nothing to say. */
export interface RouteNavBanner {
    id: string;
    /** Loaded the first time navigation starts, the navigation ui is not part of the startup graph. */
    component: () => Promise<{ default: ComponentType }>;
}

/** A row of a page section's body. */
export interface RoutePageRow {
    /** Unique in the section. */
    key: string;
    /** Handed to the component as `data`. */
    data?: unknown;
    /** dp, for a component that does not size itself. */
    height?: number;
}

/**
 * A card of the route page: a header the page draws, and body rows the feature's component draws with `item` and
 * the row's `data`. The component may dispatch `focus` with a `LensSection` of the section's lens.
 */
export interface RoutePageSection {
    id: string;
    icon: string;
    /** The icon in place of `icon`, when it says something of the route: the sky of its weather. */
    iconOf?: (ctx: RouteCtx) => string | undefined;
    title: () => string;
    /** One line under the title. */
    summary?: (ctx: RouteCtx) => string | undefined;
    /** What the line holds, as icons with their figures and colours: drawn in its place when there are any. */
    facts?: (ctx: RouteCtx) => LensFact[];
    /** The lens a row focused from this section is read in. */
    lens?: LensId;
    /** No rows: nothing to show, so no card. */
    rows: (ctx: RouteCtx) => RoutePageRow[];
    /** Loaded the first time the section has rows. */
    component: () => Promise<{ default: ComponentType }>;
}

/** A small figure of the trip strip under the tiles: a glyph, a figure and the colour of the glyph. */
export interface TripChip {
    key: string;
    /** an icon name, or a glyph of the icon font */
    icon: string;
    text: string;
    color?: string;
    /** what the chip says in words, for the one who taps it */
    help?: string;
}

/** What a feature adds to the trip strip: chips beside the times, and a line under them. */
export interface TripFigures {
    chips?: TripChip[];
    note?: string;
}

/** A row of a feature's settings, drawn by the settings screen. Backed by a store, which owns the persistence. */
export interface RouteSettingRow {
    type: 'sectionheader' | 'switch' | 'slider' | 'segment';
    title: string;
    description?: string;
    store?: SettingsStore<any>;
    min?: number;
    max?: number;
    step?: number;
    format?: (value: number) => string;
    /** The choices of a `segment`, the store holding the value of the one picked. */
    options?: { value: string; title: string }[];
}

/** A figure for a departure's cell: shown as a chip with a bar when it has a `share`, as plain text when it has not. */
export interface DepartureFigure {
    text: string;
    /** 0..1: how much of its bar the figure fills */
    share?: number;
    color?: string;
}

/** What a feature says of a ride leaving at a time, for the When panel's strip. */
export interface DepartureAssessment {
    /** Points against the departure, by what they are for: the strip adds them to the others', the lowest total is the best. */
    points: Record<string, number>;
    /** What the ride is worth a mark for: ids of the feature's `indicators`, in the order they are drawn. */
    indicators: string[];
    /** False: the feature knows nothing of this ride, which then takes no part in the ranking. */
    covered: boolean;
    /** What the departure's cell says of the ride in a figure: its text, a bar filled to a share of it and the colour of both. */
    figure?: DepartureFigure;
}

/** What a feature asks of a departure: the route, as the page has it, timed from `at`. */
export interface DepartureRequest extends RouteCtx {
    at: number;
    now: number;
    /** The analysis the route has, without the departure being looked at. */
    analysis: RouteAnalysis | null;
}

/** What the When panel shows of a feature: a line under the strip and a button beside the departure. */
export interface DepartureStatus {
    /** A few words under the strip: how fresh the data is, what the strip is scored on. */
    note: string;
    /** The feature scores the departures now. */
    scoring: boolean;
    /** epoch ms its data was last read, said in the header of the departure looked at. */
    updatedAt?: number;
    action?: { icon: string; busy?: boolean; run: () => void };
}

/** How a feature takes part in the choice of a departure. */
export interface RouteDeparture {
    /** The marks a departure can carry for this feature: a glyph and a colour for each id. */
    indicators: Record<string, { icon: string; color?: string }>;
    assess: (request: DepartureRequest) => DepartureAssessment | undefined;
    status?: (ctx: RouteCtx) => DepartureStatus | undefined;
    /** Said once the user took a departure, the route having it: a feature may ask for what it needs for it, as a forecast that does not reach it. */
    taken?: (ctx: RouteCtx) => void;
    /** Said when the user moved a `now` to the clock: what the feature holds for the time is read again. Not said: `taken` is. */
    restamped?: (ctx: RouteCtx) => void;
    /** Said once a change of the pace has settled (the sliders of the When panel): a feature that reads the ride's times may read them again. Only the ones that ask hear it: a pace is no departure. */
    paced?: (ctx: RouteCtx) => void;
}

/** A line of a stats view: how much of the route is of one kind. */
export interface RouteStatRow {
    id: string;
    label: string;
    /** km */
    dist: number;
    /** share of the route, 0..1 */
    perc: number;
    color: string;
    /** the swatch on e-ink */
    eink: string;
}

/** A view of the stats card besides the way types and the surfaces. No rows: the route has nothing to say, so no view. */
export interface RouteStatView {
    id: string;
    title: () => string;
    rows: (ctx: RouteCtx) => RouteStatRow[];
}

/**
 * One route-analysis feature: it plugs its pieces into the sheet, the navigation and the map, and can be
 * switched off without any other code changing. Contribution points are added with their consumer.
 */
export interface RouteFeature {
    id: string;
    /** Lower sorts earlier, in every surface. */
    order: number;
    /** Build-flag or platform gate. Checked once at registration. */
    enabled?: () => boolean;
    /** The user's switch, listed in Settings > Routing > Route analysis. A store, so existing settings are reused. */
    setting?: { title: () => string; store: SettingsStore<boolean> };
    /** The feature's own settings, in a page opened from under its switch while it is on. */
    settings?: () => RouteSettingRow[];
    /** Fires when a contribution depends on something other than the item (a setting, the network...). */
    changes?: Readable<unknown>;
    /** The header's tiles, in the feature's order. */
    tiles?: (ctx: RouteCtx) => RouteTile[];
    /** How the feature scores and marks the departures of the When panel's strip. */
    departure?: RouteDeparture;
    /** The colours the feature's slices and symbols are drawn in: keys of the style's palette, so the style needs to know none of its features. */
    lensPalette?: LensPaletteContribution;
    /** The ways of reading the route this feature adds to the lens bar. */
    lenses?: RouteLens[];
    /** What needs attention along the route, marked under the profile whatever the lens. */
    attention?: (ctx: RouteCtx) => AttentionMark[];
    /** A card under the sheet's actions. */
    sheetCard?: RouteSheetCard;
    /** Cards of the navigation sheet, under the actions. */
    navSections?: RouteNavSection[];
    /** Pages of the navigation dock. */
    navPages?: RouteNavPage[];
    /** Views of the stats card, read in turn with the way types and the surfaces. */
    statViews?: RouteStatView[];
    /** Cards floating over the map while navigating. */
    navBanners?: RouteNavBanner[];
    /** What the feature adds to the strip under the tiles of the route page: the times of the ride are its own. */
    trip?: (ctx: RouteCtx) => TripFigures;
    /** Cards of the route page, in the feature's order. */
    pageSections?: RoutePageSection[];
    /** GeoJSON drawn with the selected or navigated route. Rebuilt on item, route or switch changes, never per GPS fix. */
    mapFeatures?: (ctx: RouteCtx & { navigating: boolean }) => Feature[];
    /** How the feature computes its layer of the route analysis. Run by the pipeline, see `utils/routeAnalysis/pipeline`. */
    compute?: AnalysisStage;
}

const registered = writable<RouteFeature[]>([]);

/** Called at module load, so every feature is registered before the first surface renders. */
export function registerRouteFeature(feature: RouteFeature) {
    if (feature.enabled && !feature.enabled()) {
        return;
    }
    registered.update((features) => {
        if (features.some((existing) => existing.id === feature.id)) {
            return features;
        }
        return [...features, feature].sort((first, second) => first.order - second.order);
    });
}

/** Every registered feature, switched on or not: the settings page lists these. */
export const allRouteFeatures: Readable<RouteFeature[]> = registered;

/** The registered features whose user switch is on. */
export const routeFeatures: Readable<RouteFeature[]> = derived<typeof registered, RouteFeature[]>(
    registered,
    (features, set) => {
        const on = features.map(() => true);
        const emit = () => set(features.filter((_, index) => on[index]));
        const unsubscribers = features.map((feature, index) =>
            feature.setting?.store.subscribe((value) => {
                on[index] = value;
                emit();
            })
        );
        emit();
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    },
    []
);

/** Ticks whenever an enabled feature says its contributions changed. */
export const routeFeatureChanges: Readable<number> = derived(
    routeFeatures,
    (features, set) => {
        let count = 0;
        const unsubscribers = features.map((feature) => feature.changes?.subscribe(() => set(++count)));
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    },
    0
);

export function routeTiles(features: RouteFeature[], ctx: RouteCtx): RouteTile[] {
    return features.flatMap((feature) => feature.tiles?.(ctx) ?? []);
}

/** The chips and the line the enabled features add to the trip strip, in feature order. */
export function routeTrip(features: RouteFeature[], ctx: RouteCtx): { chips: TripChip[]; note: string } {
    const figures = features.flatMap((feature) => feature.trip?.(ctx) ?? []);
    return { chips: figures.flatMap((figure) => figure.chips ?? []), note: figures.flatMap((figure) => (figure.note ? [figure.note] : [])).join(' · ') };
}

/** Tells the features that take part in the departure what happened to it. A feature that does not listen for `restamped` hears `taken`; `paced` is heard by the ones that ask for it only. */
export function tellDeparture(features: RouteFeature[], ctx: RouteCtx, event: 'taken' | 'restamped' | 'paced') {
    features.forEach(({ departure }) => (event === 'paced' ? departure?.paced : event === 'restamped' ? (departure?.restamped ?? departure?.taken) : departure?.taken)?.(ctx));
}

/** Every enabled card, in order, with its height now; a height of 0 is kept so the card stays mounted. */
export function routeSheetCards(features: RouteFeature[], ctx: RouteCtx, gap: number): RouteSheetCardLayout[] {
    return features.filter((feature) => feature.sheetCard).map((feature) => ({ id: feature.id, card: feature.sheetCard, height: feature.sheetCard.height(ctx, gap) }));
}

/** The navigation sections that have something to show, in feature order. */
export function routeNavSections(features: RouteFeature[], ctx: RouteCtx, scale: number): RouteNavSectionLayout[] {
    return features
        .flatMap((feature) => feature.navSections ?? [])
        .map((section) => ({ id: section.id, section, height: section.height(scale, ctx) }))
        .filter((layout) => layout.height > 0);
}

/** The dock pages the user turned on that have something to show, in the user's order. An id nobody registers is skipped. */
export function routeNavPages(features: RouteFeature[], ctx: RouteCtx, enabled: string[]): RouteNavPage[] {
    const pages = features.flatMap((feature) => feature.navPages ?? []);
    return enabled.flatMap((id) => {
        const page = pages.find((candidate) => candidate.id === id);
        return page?.available(ctx) ? [page] : [];
    });
}

/** What the `navigationPages` setting holds, as the ids of the pages in order. */
export function parseNavPages(value: string): string[] {
    return (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id, index, ids) => id && ids.indexOf(id) === index);
}

/** The pages of someone who had set the two switches the pages replaced: the elevation chart (`profile`) and the surface bar. */
export function migrateNavPages(defaults: string[], legacy: { chart?: boolean; surface?: boolean }): string[] {
    const pages = defaults.filter((id) => legacy.chart !== false || id !== 'profile');
    if (legacy.surface && !pages.includes('surface')) {
        pages.splice(pages.indexOf('profile') + 1, 0, 'surface');
    }
    return pages;
}

/** Every dock page the enabled features register, the ones in `enabled` first in their order, then the rest in feature order: the settings list. */
export function routeNavPageChoices(features: RouteFeature[], enabled: string[]): RouteNavPage[] {
    const pages = features.flatMap((feature) => feature.navPages ?? []);
    const first = enabled.flatMap((id) => pages.filter((page) => page.id === id));
    return [...first, ...pages.filter((page) => !enabled.includes(page.id))];
}

/** The stats views the enabled features add that have something to say of this route. */
export function routeStatViews(features: RouteFeature[], ctx: RouteCtx): RouteStatView[] {
    return features.flatMap((feature) => feature.statViews ?? []).filter((view) => view.rows(ctx).length > 0);
}

/** The banners the enabled features float over the map while navigating. */
export function routeNavBanners(features: RouteFeature[]): RouteNavBanner[] {
    return features.flatMap((feature) => feature.navBanners ?? []);
}

/** Lazy components, loaded once and kept. A store, so the view renders a component when it arrives. */
export function lazyComponents() {
    const { subscribe, update } = writable<Record<string, ComponentType>>({});
    const requested = new Set<string>();
    return {
        subscribe,
        async load(id: string, loader: () => Promise<{ default: ComponentType }>) {
            if (requested.has(id)) {
                return;
            }
            requested.add(id);
            try {
                const component = (await loader()).default;
                update((components) => ({ ...components, [id]: component }));
            } catch (error) {
                requested.delete(id);
                console.error('lazyComponents', id, error);
            }
        }
    };
}

/** What the enabled features add to the route's layer. */
export function routeMapFeatures(features: RouteFeature[], ctx: RouteCtx & { navigating: boolean }): Feature[] {
    return features.flatMap((feature) => feature.mapFeatures?.(ctx) ?? []);
}

/** The stages the enabled features contribute to the route analysis pipeline. */
export function routeStages(features: RouteFeature[]): AnalysisStage[] {
    return features.flatMap((feature) => (feature.compute ? [feature.compute] : []));
}

/** The lenses the enabled features offer this route, in the bar's order. */
export function routeLenses(features: RouteFeature[], ctx: RouteCtx): RouteLens[] {
    return features
        .flatMap((feature) => feature.lenses ?? [])
        .filter((lens) => lens.available(ctx))
        .sort((first, second) => LENS_ORDER.indexOf(first.id) - LENS_ORDER.indexOf(second.id));
}

/** What the enabled features want looked at. */
export function routeAttention(features: RouteFeature[], ctx: RouteCtx): AttentionMark[] {
    return features.flatMap((feature) => feature.attention?.(ctx) ?? []);
}

/** The lens to show: the one asked for, or the overview when this route cannot show it. */
export function resolveLens(requested: LensId, lenses: RouteLens[]): LensId {
    return lenses.some((lens) => lens.id === requested) ? requested : 'overview';
}

/** The cards the enabled features add to the route page, in feature order. */
export function routePageSections(features: RouteFeature[]): RoutePageSection[] {
    return features.flatMap((feature) => feature.pageSections ?? []);
}
