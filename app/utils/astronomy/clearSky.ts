/**
 * How much of the sun's direct light gets through the clouds. Pure: nothing of the app in it, so the weather apps of the
 * family can share it.
 */

/** Under this altitude the clear-sky model is not to be trusted, degrees. */
const MIN_ALTITUDE = 5;

/** Direct normal irradiance of a clear sky, W/m2, by Meinel: the sun at `altitude` degrees, the observer `elevation` metres up. */
export function clearSkyDni(altitude: number, elevation: number): number {
    const air = 1 / Math.sin((altitude * Math.PI) / 180);
    const kilometers = Math.max(0, elevation) / 1000;
    return 1353 * ((1 - 0.14 * kilometers) * Math.pow(0.7, Math.pow(air, 0.678)) + 0.14 * kilometers);
}

export interface Sky {
    /** forecast direct normal irradiance, W/m2 */
    dni?: number;
    /** forecast cloud cover, % */
    cloud?: number;
    /** the sun's altitude, degrees */
    altitude: number;
    /** m */
    elevation: number;
}

/**
 * The share of the clear-sky sun that reaches the ground, 0 to 1: the forecast's direct irradiance against what a clear sky
 * gives, else the sky left by the cloud cover, which is a poor stand-in. None when the forecast says nothing.
 */
export function clearness({ altitude, cloud, dni, elevation }: Sky): number | undefined {
    if (dni !== undefined && altitude >= MIN_ALTITUDE) {
        return Math.max(0, Math.min(1, dni / clearSkyDni(altitude, elevation)));
    }
    return cloud === undefined ? undefined : Math.max(0, Math.min(1, 1 - cloud / 100));
}

/** Under this share of the sun getting through, a shadow is too faint to be worth the pass that draws it. */
const MIN_SHADOW_CLEARNESS = 0.08;

/** How strong the shadows are: the user's strength, as much as the sun gets through, none when it hardly does. 1 where the forecast says nothing. */
export function shadowStrengthFor(strength: number, clear: number | undefined): number {
    if (clear === undefined) {
        return strength;
    }
    return clear < MIN_SHADOW_CLEARNESS ? 0 : strength * clear;
}
