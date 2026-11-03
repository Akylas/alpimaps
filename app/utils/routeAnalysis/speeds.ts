import type { Activity } from './types';

/** Flat-ground speed (km/h) of an activity. No activity is read as a walk. */
export function flatSpeedKmh(activity?: Activity): number {
    switch (activity?.kind) {
        case 'bike':
            switch (activity.subtype) {
                case 'enduro':
                    return 10;
                case 'mountain':
                    return 12;
                case 'gravel':
                    return 18;
                case 'road':
                    return 20;
                default:
                    return 15;
            }
        case 'motor':
            return 50;
        default:
            return activity?.subtype === 'run' ? 12 : 4;
    }
}

const MAX_SLOPE = 0.4;
// Tobler's hiking function peaks on a 5% descent
const TOBLER_PEAK = Math.exp(-3.5 * 0.05);

/**
 * Speed (km/h) on a slope (rise over run). Hiking follows Tobler's function, a bike pays for the
 * climb and gains on a descent up to 8%, a motor vehicle ignores the slope.
 */
export function gradeSpeedKmh(activity: Activity | undefined, slope: number): number {
    const flat = flatSpeedKmh(activity);
    const clamped = Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, slope));
    switch (activity?.kind) {
        case 'motor':
            return flat;
        case 'bike':
            return clamped >= 0 ? flat / (1 + 10 * clamped) : flat * (1 + 6 * Math.min(-clamped, 0.08));
        default:
            return (flat * Math.exp(-3.5 * Math.abs(clamped + 0.05))) / TOBLER_PEAK;
    }
}
