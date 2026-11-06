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
