import type { Feature } from 'geojson';
import type { ComponentType } from 'svelte';
import { type Readable, derived, writable } from 'svelte/store';
import type { SettingsStore } from '~/stores/settingsStore';
import type { SurfacePattern } from '~/utils/surfacePattern';
import type { IItem } from '~/models/Item';
import type { AnalysisStage } from '~/utils/routeAnalysis/pipeline';

/** What every contribution is asked about. */
export interface RouteCtx {
    item: IItem;
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
export type AttentionKind = 'steep';

export interface AttentionMark {
    kind: AttentionKind;
    /** How hard it is, 1 to 3: the mark is thicker the harder. */
    tier?: 1 | 2 | 3;
    /** The lens and section a tap on the mark goes to. */
    lens: LensId;
    section: LensSection;
}

/** An attention mark on the chart, meters from the start. */
export interface ProfileMark {
    from: number;
    to: number;
    kind: AttentionKind;
    tier?: 1 | 2 | 3;
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

/** A plate on the route at vertex `i`: a speed sign, a climb's category. `p` is its placement priority, the higher wins. */
export interface LensSymbol {
    sym: 'speed' | 'grade' | 'climb' | 'climbtip' | 'wx' | 'wind' | 'sunset' | 'sunrise' | 'night';
    i: number;
    t: string;
    /** A smaller line under `t`. */
    t2?: string;
    icon?: string;
    /** Degrees, for an arrow. */
    rot?: number;
    s: 0 | 1 | 2 | 3;
    /** The data it shows is out of date. */
    stale?: 0 | 1;
    p: number;
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
    /** The hatch that says it where colour cannot, on e-ink. The grade's own when missing. */
    pattern?: SurfacePattern;
}

/** What a lens asks of the profile chart. */
export interface LensProfile {
    brackets?: ProfileBracket[];
    /** The fill's colours, when they are not the grade's. */
    fill?: ProfileFillStop[];
}

/** One way of reading the route: it colours the line and fills the profile, see `routeLensStore`. */
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
}

/** A block of the navigation sheet: `details` cards get `item` and their card look, `ahead` widgets their `height`. */
export interface RouteNavSection {
    id: string;
    /** `ahead`: a widget of the one row above the actions; `details`: a card of its own under them. */
    slot: 'ahead' | 'details';
    /** Loaded the first time the section has a height, the navigation ui is not part of the startup graph. */
    component: () => Promise<{ default: ComponentType }>;
    /** dp at the navigation scale. 0: nothing to show, so no row. */
    height: (scale: number, ctx: RouteCtx) => number;
    /** The share of the ahead row's width. */
    weight?: number;
}

export interface RouteNavSectionLayout {
    id: string;
    section: RouteNavSection;
    height: number;
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
    title: () => string;
    /** One line under the title. */
    summary?: (ctx: RouteCtx) => string | undefined;
    /** The lens a row focused from this section is read in. */
    lens?: LensId;
    /** No rows: nothing to show, so no card. */
    rows: (ctx: RouteCtx) => RoutePageRow[];
    /** Loaded the first time the section has rows. */
    component: () => Promise<{ default: ComponentType }>;
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
    /** The ways of reading the route this feature adds to the lens bar. */
    lenses?: RouteLens[];
    /** What needs attention along the route, marked under the profile whatever the lens. */
    attention?: (ctx: RouteCtx) => AttentionMark[];
    /** A card under the sheet's actions. */
    sheetCard?: RouteSheetCard;
    /** Blocks of the navigation sheet. */
    navSections?: RouteNavSection[];
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
