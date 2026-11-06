/** The colours of the weather, one place for the map, the profile and the page. Pure: nothing here may import NativeScript. */

export const RAIN_BLUE = '#4A90D9';
const RAIN_BLUE_DARK = '#1565C0';
const COLD = '#3F8FE0';
const WARM = '#F29D38';
const HOT = '#D7263D';
/** The temperature line of the profile. */
export const TEMP_LINE = '#B5D334';
export const HEADWIND_HARD_COLOR = '#D7263D';
const HEADWIND_COLOR = '#F29D38';
export const TAILWIND_COLOR = '#2E9E5B';

/** km/h of wind against the ride that is hard going, and from which a wind along the ride is worth a colour */
const WIND_HARD = 20;
const WIND_NOTICEABLE = 10;

/** mm of rain that fill a rain bar, on the cards and in the When panel's cells */
export const RAIN_BAR_MAX = 5;

/** A colour at a share of its opacity, as the #RRGGBBAA the views read. `hex`: #RRGGBB */
export function tint(hex: string, opacity: number): string {
    const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255);
    return hex + alpha.toString(16).toUpperCase().padStart(2, '0');
}

export const CLOUD_GRAY = '#8D96A3';
/** The sun, as it is highlighted as the rain and the cloud are. */
export const SUN_COLOR = '#F2B72E';
/** % of cloud under which the sky is clear: the sun is what the ride has to say of it. */
export const SUNNY_CLOUD = 40;
/** mm/h from which the wash of the rain is the strongest */
const RAIN_WASH_FULL = 4;

/** The wash of a cloud chip: the grey of the sky, the stronger the more of it is covered. */
export function cloudTint(cloudPercent: number): string {
    return tint(CLOUD_GRAY, 0.1 + 0.3 * Math.max(0, Math.min(1, cloudPercent / 100)));
}

/** The wash of a rain chip: the blue of the rain, the stronger the harder it rains. */
export function rainTint(mmPerHour: number): string {
    return tint(RAIN_BLUE, 0.14 + 0.3 * Math.max(0, Math.min(1, mmPerHour / RAIN_WASH_FULL)));
}

/** The wash behind the wind of a sample: red for a burst worth a warning, else the colour of a wind worth one. None for a plain wind. */
export function windWash(head: number | undefined, gust: number | undefined, gustMin: number): string | undefined {
    if (gust !== undefined && gust >= gustMin) {
        return tint(HEADWIND_HARD_COLOR, 0.2);
    }
    const color = windColor(head);
    return color ? tint(color, 0.18) : undefined;
}

/** The rain bar of a sample is as plain as the chance of it, as oss-weather draws it: half sure when the forecast does not say. */
export function rainBarTint(probabilityPercent: number | undefined): string {
    return tint(RAIN_BLUE, Math.max(0.25, (probabilityPercent ?? 55) / 100));
}

/** dp high of the rain bar of a sample, as high as the rain as oss-weather draws it: 14 for a drizzle, 42 from 5 mm/h */
export function rainBarHeight(mmPerHour: number): number {
    return 14 + 28 * Math.max(0, Math.min(1, mmPerHour / RAIN_BAR_MAX));
}

/** The wash of a sun chip: the yellow of the sun, the stronger the clearer the sky. */
export function sunTint(cloudPercent: number): string {
    return tint(SUN_COLOR, 0.16 + 0.3 * (1 - Math.max(0, Math.min(1, cloudPercent / 100))));
}

/** The band of the cloud cover over the samples: the grey of the cloud, the stronger the more of the sky is covered, each sample a piece of one strip. */
export function cloudBand(cloudPercent: number): string {
    return tint(CLOUD_GRAY, 0.12 + 0.6 * Math.max(0, Math.min(1, cloudPercent / 100)));
}

/** The band of the sky over the samples: the sun under 40 % of cloud, the stronger the clearer, else the grey of the cloud. */
export function skyBand(cloudPercent: number): string {
    return cloudPercent < SUNNY_CLOUD ? tint(SUN_COLOR, 0.25 + (0.45 * (SUNNY_CLOUD - Math.max(0, cloudPercent))) / SUNNY_CLOUD) : cloudBand(cloudPercent);
}

/** Rain as the profile draws it: blue, darker from 4 mm/h. None for dry. */
export function rainColor(mmPerHour: number): string | undefined {
    return mmPerHour < 0.1 ? undefined : mmPerHour >= 4 ? RAIN_BLUE_DARK : RAIN_BLUE;
}

/** Only the cold (freezing or under) and the heat (from 25 degrees) have a colour: the rest is neutral. */
export function tempColor(celsius: number): string | undefined {
    return celsius <= 0 ? COLD : celsius >= 33 ? HOT : celsius >= 25 ? WARM : undefined;
}

/** A wind against the ride is orange from 10 km/h and red from 20, one behind it green from 10. None for the rest. */
export function windColor(head: number | undefined): string | undefined {
    if (head === undefined) {
        return undefined;
    }
    return head >= WIND_HARD ? HEADWIND_HARD_COLOR : head >= WIND_NOTICEABLE ? HEADWIND_COLOR : head <= -WIND_NOTICEABLE ? TAILWIND_COLOR : undefined;
}
