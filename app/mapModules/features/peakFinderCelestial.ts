import type { MassifLayer, MassifMap, MassifObject, Subscription } from '@nativescript-community/ui-massifmaps/api';
import { Canvas, Paint, Style } from '@nativescript-community/ui-canvas';
import { Color, ImageSource, Screen, path as filePath, knownFolders } from '@nativescript/core';
import { type Readable, get } from 'svelte/store';
import { langStore } from '~/helpers/locale';
import type { Horizontal } from '~/mapModules/features/sky/astronomy';
import { networkService } from '~/services/NetworkService';
import { type SelectedSky, peakFinderSelectedPeak, peakFinderSelectedSky, peakFinderSkyTime } from '~/stores/terrainStore';
import type { MapPos } from '~/utils/geo';
import { openURL } from '~/utils/ui/index.common';

export interface PeakFinderSkyContext {
    map: MassifMap;
    /** Where the eye stands, or null before the camera is placed. */
    eye: () => MapPos | null;
    dark: () => boolean;
}

export function colour(red: number, green: number, blue: number, alpha = 1) {
    return new Color(Math.round(alpha * 255), red, green, blue).argb;
}

export function skyMoment() {
    return get(peakFinderSkyTime) ?? Date.now();
}

export function addTo<T extends MassifObject>(layer: MassifLayer, object: T) {
    layer.call('add', object.handle);
    return object;
}

export interface CelestialBody {
    enabled: Readable<boolean>;
    /** How often to redraw while following the clock. */
    clockMs: number;
    start(context: PeakFinderSkyContext): void;
    /** `force`: re-plan even when nothing it keys on moved. */
    update(force?: boolean): void;
    /** Removes and releases everything `start` built, and forgets the context. */
    drop(): void;
    /** Other stores that re-plan it, with how. */
    triggers?: [Readable<unknown>, () => void][];
}

// built while enabled, rebuilt when re-enabled, redrawn on the moment and on a clock while it is now
export function celestialLifecycle(body: CelestialBody) {
    let context: PeakFinderSkyContext = null;
    let clock: ReturnType<typeof setInterval> = null;
    let unsubscribers: (() => void)[] = [];

    function start() {
        body.start(context);
        body.update(true);
        clock = setInterval(() => get(peakFinderSkyTime) === null && body.update(), body.clockMs);
    }
    function stop() {
        clearInterval(clock);
        clock = null;
        body.drop();
    }
    function teardown() {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
        unsubscribers = [];
        stop();
        context = null;
    }
    function setup(skyContext: PeakFinderSkyContext) {
        teardown();
        context = skyContext;
        if (get(body.enabled)) {
            start();
        }
        let first = true;
        unsubscribers = [
            body.enabled.subscribe((enabled) => {
                if (first || !context) {
                    return;
                }
                stop();
                if (enabled) {
                    start();
                }
            }),
            peakFinderSkyTime.subscribe(() => !first && body.update()),
            ...(body.triggers ?? []).map(([store, run]) => store.subscribe(() => !first && run()))
        ];
        first = false;
    }
    return { setup, teardown };
}

type SkyResolver = (id: string) => { selected: SelectedSky; locate: () => Horizontal | null } | null;

let selectionContext: PeakFinderSkyContext = null;
let ringLayer: MassifLayer = null;
let ring: MassifObject<'massif::CelestialSprite'> = null;
let ringDark: boolean = null;
let locateSelected: () => Horizontal | null = null;
let ringGeneration = 0;

// objects carry `metaData.id`; `resolve` maps it to the chip content and a locator as the sky turns
export function listenToSkyClicks(layer: MassifLayer, resolve: SkyResolver): Subscription {
    return layer.onCelestialClick((event) => {
        const metaData = event.get('celestialObject.metaData') as { [key: string]: unknown };
        const id = metaData?.id;
        const found = typeof id === 'string' ? resolve(id) : null;
        if (!found) {
            return;
        }
        event.consumed = true;
        locateSelected = found.locate;
        peakFinderSelectedPeak.set(null);
        peakFinderSelectedSky.set(found.selected);
        refreshSkySelection();
    });
}

function ringBitmapUrl(dark: boolean) {
    const size = 96;
    const canvas = new Canvas(size, size);
    const paint = new Paint();
    paint.setAntiAlias(true);
    paint.setStyle(Style.STROKE);
    paint.setStrokeWidth(size * 0.07);
    paint.setColor(dark ? '#fbbf24' : '#b45309');
    canvas.drawCircle(size / 2, size / 2, size * 0.4, paint);
    const file = filePath.join(knownFolders.temp().path, `peakFinderSkyRing.${dark ? 'd' : 'l'}.png`);
    new ImageSource(canvas.getImage()).saveToFile(file, 'png');
    return `file://${file}`;
}

function buildRing() {
    const map = selectionContext.map;
    ringGeneration += 1;
    // Last, and out of the post-process: over everything, crisp.
    ringLayer = map.buildLayer(`layer.sky.selection.${ringGeneration}`, { type: 'celestial', postProcessed: false });
    map.add(ringLayer);
    ring = addTo(ringLayer, map.object('celestial', `sky.selection.${ringGeneration}`, { type: 'sprite', screenSize: 30 * Screen.mainScreen.scale, color: colour(255, 255, 255), visible: false }));
    ringDark = null;
}

/** Re-places the ring on the selected object: after every body's update, as the sky turns. */
export function refreshSkySelection() {
    if (!selectionContext) {
        return;
    }
    const located = get(peakFinderSelectedSky) && locateSelected ? locateSelected() : null;
    if (!located) {
        ring?.set('visible', false);
        return;
    }
    if (!ring) {
        buildRing();
    }
    const dark = selectionContext.dark();
    if (dark !== ringDark) {
        ringDark = dark;
        ring.set('bitmap', { type: 'url', url: ringBitmapUrl(dark) });
    }
    ring.call('setDirection', located.azimuth, located.altitude, 0);
    ring.set('visible', true);
}

/** Keeps the ring over a rebuilt summit layer. */
export function raiseSkySelection() {
    if (!selectionContext || !ringLayer) {
        return;
    }
    selectionContext.map.removeLayer(ringLayer);
    selectionContext.map.add(ringLayer);
}

/** Clears the selection, or only when it is one of `kinds` - a body switched off takes its own. */
export function clearSkySelection(kinds?: SelectedSky['kind'][]) {
    const selected = get(peakFinderSelectedSky);
    if (!selected || (kinds && !kinds.includes(selected.kind))) {
        return;
    }
    locateSelected = null;
    peakFinderSelectedSky.set(null);
    ring?.set('visible', false);
}

export function setupSkySelection(context: PeakFinderSkyContext) {
    teardownSkySelection();
    selectionContext = context;
}

export function teardownSkySelection() {
    clearSkySelection();
    if (ringLayer) {
        try {
            selectionContext?.map.removeLayer(ringLayer);
        } catch (error) {
            DEV_LOG && console.log('peakFinder: sky selection layer', error);
        }
    }
    ring?.destroy();
    ringLayer?.destroy();
    ring = ringLayer = null;
    selectionContext = null;
}

/**
 * The object's Wikipedia page in the app's language, else the English one, else its Wikidata item:
 * Wikidata's own redirect shows a form, not a fallback, when the language has no article.
 */
export async function openSkyWikipedia(selected: SelectedSky) {
    if (!selected.wikidata) {
        return openURL(`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(selected.name)}`);
    }
    const language = ((get(langStore) as string) || 'en').split(/[-_]/)[0];
    try {
        const result = await networkService.request<{ entities: { [id: string]: { sitelinks?: { [site: string]: { title: string } } } } }>({
            url: 'https://www.wikidata.org/w/api.php',
            method: 'GET',
            // Wikimedia answers 403 to a request without one.
            headers: { 'User-Agent': __APP_ID__ },
            queryParams: { action: 'wbgetentities', format: 'json', props: 'sitelinks', ids: selected.wikidata, sitefilter: `${language}wiki|enwiki` }
        });
        const sitelinks = result?.entities?.[selected.wikidata]?.sitelinks ?? {};
        for (const site of [language, 'en']) {
            const title = sitelinks[`${site}wiki`]?.title;
            if (title) {
                return openURL(`https://${site}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`);
            }
        }
    } catch (error) {
        DEV_LOG && console.log('peakFinder: wikipedia', selected.wikidata, error);
    }
    return openURL(`https://www.wikidata.org/wiki/${selected.wikidata}`);
}
