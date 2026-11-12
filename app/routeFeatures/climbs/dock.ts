/** What the climb page of the dock says. Pure: nothing here may import NativeScript. */
import type { Climb, SteepSection } from '~/routeFeatures/climbs/steep';

export interface ClimbNow {
    /** `on`: inside the climb; `next`: it is still to come */
    mode: 'on' | 'next';
    climb: Climb;
    /** `on`: meters of climb left to the summit; `next`: what the climb gains */
    gain: number;
    /** `on`: meters of road left to the summit; `next`: meters to the foot of it */
    distance: number;
}

export interface SteepNow {
    /** signed %, as the section has it */
    grade: number;
    /** `inside`: meters left of it; else meters to its start */
    distance: number;
    inside: boolean;
}

/** The climb the rider is in, else the next one; the summit itself is where a climb is over. Null when none is left. `climbs` run in route order. */
export function climbNow(climbs: Climb[], data: { d: number; a: number }[], index: number): ClimbNow | null {
    if (index < 0 || !data.length) {
        return null;
    }
    const here = data[Math.min(index, data.length - 1)];
    const current = climbs.find((climb) => index >= climb.startIndex && index < climb.endIndex);
    if (current) {
        const summit = data[Math.min(current.endIndex, data.length - 1)];
        return { mode: 'on', climb: current, gain: Math.max(summit.a - here.a, 0), distance: Math.max(summit.d - here.d, 0) };
    }
    const next = climbs.find((climb) => climb.startIndex > index);
    return next ? { mode: 'next', climb: next, gain: next.gain, distance: Math.max(next.startDistance - here.d, 0) } : null;
}

/** The steep way up the rider is on, else the next one. Null when none is left. `steep` runs in route order. */
export function steepNow(steep: SteepSection[], data: { d: number }[], index: number): SteepNow | null {
    if (index < 0 || !data.length) {
        return null;
    }
    const here = data[Math.min(index, data.length - 1)];
    const section = steep.find((candidate) => candidate.direction === 'up' && candidate.endIndex > index);
    if (!section) {
        return null;
    }
    const inside = section.startIndex <= index;
    return { grade: section.avgGrade, distance: Math.max((inside ? section.endDistance : section.startDistance) - here.d, 0), inside };
}
