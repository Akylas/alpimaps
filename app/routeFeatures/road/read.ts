import { get } from 'svelte/store';
import { convertFamilyValue, formatDistance, formatFamilyValue } from '~/helpers/formatter';
import { UNITS, UNIT_FAMILIES } from '~/helpers/units';
import type { IItem } from '~/models/Item';
import { classifyRisk } from '~/routeFeatures/road/risk';
import { type RoadRead, type RoadWords, buildRoadRead } from '~/routeFeatures/road/sections';
import { roadMinLength, roadSettingsKey, roadThreshold } from '~/routeFeatures/road/settings';

export const roadWords: RoadWords = {
    speed: (kmh) => formatFamilyValue(kmh, UNIT_FAMILIES.Speed, UNITS.SpeedKm),
    speedNumber: (kmh) => String(convertFamilyValue(kmh, UNIT_FAMILIES.Speed, UNITS.SpeedKm)[0]),
    distance: formatDistance
};

// the layer is replaced, never edited, so it keys what was read off it, with the profile it was laid on and what it was read with
let settingsKey = '';
roadSettingsKey.subscribe((key) => (settingsKey = key));
const reads = new WeakMap<object, { key: string; data: unknown; read: RoadRead }>();

/** The risky sections of the route as the user's settings classify them, `null` until the risk layer is there. Derived on read, never stored. */
export function readRoad(item: IItem): RoadRead | null {
    const layer = item?.analysis?.layers.risk;
    const data = item?.profile?.data;
    if (!layer || !data?.length) {
        return null;
    }
    // what the signs say depends on the speed unit
    const key = `${settingsKey}|${convertFamilyValue(1, UNIT_FAMILIES.Speed, UNITS.SpeedKm)[1]}`;
    const cached = reads.get(layer);
    if (cached?.key === key && cached.data === data) {
        return cached.read;
    }
    const sections = classifyRisk(layer.data.candidates, { threshold: get(roadThreshold), minLength: get(roadMinLength) });
    const read = buildRoadRead(sections, layer.data.unknown, data, roadWords);
    reads.set(layer, { key, data, read });
    return read;
}
