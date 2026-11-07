/**
 * The route sun mode: the 3D map lit with the sun of a time of the ride. The profile's cursor is the time, the departure and the
 * pace say when the ride is where, and the forecast says how much of the sun gets through. It lights through `routeSunLight`, which
 * the user's own sun settings never feel.
 */
import { goBack } from '@shared/utils/svelte/ui';
import { derived, get, writable } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { isEInk } from '~/helpers/theme';
import type { IItem } from '~/models/Item';
import { getMapContext } from '~/mapModules/MapModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { registerMapModule } from '~/mapModules/registry';
import { routeAnalysisChanges } from '~/routeFeatures/analysisRunner';
import { focusKeyOf, routeFocus } from '~/routeFeatures/lens/routeFocusStore';
import { type SunRead, readSun } from '~/routeFeatures/sun/read';
import { NavigationState, navigationState } from '~/stores/navigationStore';
import { routeSunLight } from '~/stores/terrainStore';
import { clearTimeout, setTimeout } from '~/utils/utils';

/** The route whose sun lights the map, none when the mode is off. */
export const routeSunMode = writable<{ item: IItem; itemKey: string } | null>(null);

/** e-ink redraws slowly: the light waits for the cursor to rest */
const EINK_REST_MS = 300;

let unsubscribers: (() => void)[] = [];
let read: { item: IItem; analysis: unknown; value: SunRead | null } = null;
let rest: ReturnType<typeof setTimeout> = null;

function readOf(item: IItem) {
    if (read?.item !== item || read.analysis !== item.analysis) {
        read = { item, analysis: item.analysis, value: readSun(item, Date.now()) };
    }
    return read.value;
}

/** The light at the profile's cursor, at the start while there is none. Degrees to a tenth: a finer move is not worth a new light. */
function applyLight(itemKey: string, item: IItem) {
    const focus = get(routeFocus);
    const index = focus?.itemKey === itemKey ? (focus.cursor?.index ?? 0) : 0;
    const point = readOf(item)?.at(index);
    if (!point) {
        return;
    }
    const next = { azimuth: Math.round(point.azimuth * 10) / 10, altitude: Math.round(point.altitude * 10) / 10, clearness: point.clearness };
    const current = get(routeSunLight);
    if (current?.azimuth !== next.azimuth || current.altitude !== next.altitude || current.clearness !== next.clearness) {
        routeSunLight.set(next);
    }
}

function schedule(itemKey: string, item: IItem) {
    if (!isEInk) {
        applyLight(itemKey, item);
        return;
    }
    clearTimeout(rest);
    rest = setTimeout(() => applyLight(itemKey, item), EINK_REST_MS);
}

export function stopRouteSunMode() {
    clearTimeout(rest);
    rest = null;
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribers = [];
    read = null;
    if (get(routeSunMode)) {
        routeSunMode.set(null);
        routeSunLight.set(null);
    }
}

/** Shows the route on the main map in 3D, lit by the sun of the ride. */
export async function startRouteSunMode(item: IItem) {
    const context = getMapContext();
    goBack({ to: context.getMainPage() });
    await context.selectItem({ item, isFeatureInteresting: true });
    // the 3D module is not part of what the route features need at startup
    const { is3D, setTerrain3DImmediate } = await import('~/mapModules/features/terrain3d');
    if (!is3D()) {
        setTerrain3DImmediate(true);
    }
    stopRouteSunMode();
    const itemKey = focusKeyOf(item);
    routeSunMode.set({ item, itemKey });
    unsubscribers = [
        routeFocus.subscribe(() => schedule(itemKey, item)),
        // a new departure or pace moves the ride in the sky
        routeAnalysisChanges.subscribe(() => {
            read = null;
            schedule(itemKey, item);
        }),
        // a ride being followed has its own light: the mode is for looking at the plan
        navigationState.subscribe((state) => {
            if (state !== NavigationState.IDLE) {
                stopRouteSunMode();
            }
        })
    ];
}

// another route, or none (the route deselected or deleted): the mode ends with the route it was for
registerMapModule('routeSun', {
    onSelectedItem: (item) => {
        const mode = get(routeSunMode);
        if (mode && focusKeyOf(item) !== mode.itemKey) {
            stopRouteSunMode();
        }
    }
});

registerMapFeature({
    id: 'routeSun',
    sideButtons: derived(routeSunMode, (mode) => [
        {
            id: 'routeSun',
            // under the 3D button (15)
            order: 16,
            text: 'mdi-white-balance-sunny',
            tooltip: lc('sun_mode_exit'),
            isSelected: true,
            visible: !!mode,
            onTap: () => stopRouteSunMode()
        }
    ])
});
