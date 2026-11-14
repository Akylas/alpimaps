/** Which side streets may be entered from the road ahead. Pure: nothing here may import NativeScript. */

/** Turning less than this off the way in is a bend, not a side street; more than the max is the way back. */
const MIN_TURN = 20;
const MAX_TURN = 160;

export interface JunctionExit {
    /** degrees clockwise from north, leaving the junction along this way */
    heading: number;
    /** the travel mode may go out along it */
    enterable: boolean;
}

export interface Junction {
    /** meters along the look-ahead or the route, in one frame per list */
    distance: number;
    lat: number;
    lon: number;
    /** heading of the way in */
    arrival: number;
    exits: JunctionExit[];
}

export interface RoadAhead {
    kind: 'noEntry' | 'end';
    distance: number;
}

export interface LookAhead {
    junctions: Junction[];
    ahead?: RoadAhead;
}

export interface TurnOption {
    /** meters from the user */
    distance: number;
    lat: number;
    lon: number;
}

/** The side an exit leaves on, null for straight on, a slight bend or the way back. */
export function exitSide(arrival: number, heading: number): 'left' | 'right' | null {
    const delta = ((((heading - arrival) % 360) + 540) % 360) - 180;
    if (delta >= MIN_TURN && delta <= MAX_TURN) {
        return 'right';
    }
    if (delta <= -MIN_TURN && delta >= -MAX_TURN) {
        return 'left';
    }
    return null;
}

/** The first junction within `lead` meters, from `from` on, where each side may be entered. */
export function turnOptions(junctions: Junction[], from: number, lead: number): { left: TurnOption | null; right: TurnOption | null } {
    const options: { left: TurnOption | null; right: TurnOption | null } = { left: null, right: null };
    for (const junction of junctions) {
        if (junction.distance < from || junction.distance > from + lead) {
            continue;
        }
        for (const side of ['left', 'right'] as const) {
            if (!options[side] && junction.exits.some((exit) => exit.enterable && exitSide(junction.arrival, exit.heading) === side)) {
                options[side] = { distance: junction.distance - from, lat: junction.lat, lon: junction.lon };
            }
        }
    }
    return options;
}

export function roadAheadChip(ahead: RoadAhead | undefined, from: number, lead: number): RoadAhead | null {
    if (!ahead || ahead.distance < from || ahead.distance > from + lead) {
        return null;
    }
    return { kind: ahead.kind, distance: ahead.distance - from };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseJunction(value: unknown): Junction | null {
    if (!isRecord(value) || !Array.isArray(value.exits)) {
        return null;
    }
    const { arrival, distance, lat, lon } = value;
    if (typeof distance !== 'number' || typeof lat !== 'number' || typeof lon !== 'number' || typeof arrival !== 'number') {
        return null;
    }
    const exits: JunctionExit[] = [];
    for (const exit of value.exits) {
        if (isRecord(exit) && typeof exit.heading === 'number' && typeof exit.enterable === 'boolean') {
            exits.push({ heading: exit.heading, enterable: exit.enterable });
        }
    }
    return { distance, lat, lon, arrival, exits };
}

/** The JSON the SDK's `lookAhead` returns; anything unreadable is an empty look-ahead. */
export function parseLookAhead(json: string | undefined): LookAhead {
    let parsed: unknown;
    try {
        parsed = json ? JSON.parse(json) : null;
    } catch {
        return { junctions: [] };
    }
    if (!isRecord(parsed)) {
        return { junctions: [] };
    }
    const junctions: Junction[] = [];
    if (Array.isArray(parsed.junctions)) {
        for (const value of parsed.junctions) {
            const junction = parseJunction(value);
            if (junction) {
                junctions.push(junction);
            }
        }
    }
    const result: LookAhead = { junctions };
    const { ahead } = parsed;
    if (isRecord(ahead) && (ahead.kind === 'noEntry' || ahead.kind === 'end') && typeof ahead.distance === 'number') {
        result.ahead = { kind: ahead.kind, distance: ahead.distance };
    }
    return result;
}
