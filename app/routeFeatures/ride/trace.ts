/** The trace of a ride being recorded, built a fix at a time. Pure: nothing here may import NativeScript. */
import { type RideFix, isRideFix, isRideStep } from '~/routeFeatures/ride/track';

/** fixes the tail holds before it joins the committed part: the tail is what is redrawn on every fix */
export const TRACE_TAIL_LENGTH = 50;

/**
 * The line drawn so far in two parts: the committed one only grows every `tailLength` fixes, so it is handed
 * to the map that seldom, and the tail (the last stretch) is small enough to hand over on every fix.
 */
export function createTrace(tailLength = TRACE_TAIL_LENGTH) {
    let committed: [number, number][] = [];
    let tail: [number, number][] = [];
    let last: RideFix | undefined;

    return {
        /** Adds a fix. What changed: the tail, or the committed part too; none when the ride leaves the fix out. */
        add(fix: RideFix): 'tail' | 'committed' | null {
            if (!isRideFix(fix) || !isRideStep(last, fix)) {
                return null;
            }
            last = fix;
            tail.push([fix.lon, fix.lat]);
            if (tail.length < tailLength) {
                return 'tail';
            }
            // the tail's last point starts the next one, so the two parts meet
            committed.push(...tail.slice(committed.length ? 1 : 0));
            tail = [tail[tail.length - 1]];
            return 'committed';
        },
        committed: () => committed,
        tail: () => tail,
        reset() {
            committed = [];
            tail = [];
            last = undefined;
        }
    };
}
