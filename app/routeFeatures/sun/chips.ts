/** The chips of the sun, for the route page and the trip strip. */
import { formatDistance, formatDuration } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { SUN_EVENTS } from '~/routeFeatures/sun/colors';
import { explainChip } from '~/routeFeatures/sun/explain';

export interface SunChip {
    key: string;
    icon: string;
    text: string;
    color?: string;
    alert?: boolean;
    help: string;
}

export interface SunChipEvent {
    id: 'sunrise' | 'sunset' | 'dusk' | 'moonrise' | 'moonset';
    at: number;
    relation: 'during' | 'before' | 'after';
    /** m from the start, for an event during the ride */
    distance?: number;
    /** ms before the start or after the end, for an event out of the ride */
    ms?: number;
}

/** The icon says what the event is, the time all the chip says; a tap says the rest (`help`). */
export function eventChip(event: SunChipEvent, clock: (at: number) => string): SunChip {
    const { icon, color } = SUN_EVENTS[event.id];
    const time = clock(event.at);
    const where = event.relation === 'during' ? formatDistance(event.distance) : formatDuration(event.ms / 1000);
    return { key: event.id, icon, color, text: time, help: explainChip({ kind: event.id, time, relation: event.relation, where }, lc) };
}

/** How long the dark and the moonlight last (`amount` in ms), how far the glare does (in m). */
export function figureChip(kind: 'dark' | 'moonlit' | 'glare', amount: number): SunChip {
    const { icon, color } = SUN_EVENTS[kind];
    const length = kind === 'glare' ? formatDistance(amount) : formatDuration(amount / 1000);
    return { key: kind, icon, color, text: length, alert: kind === 'glare' ? true : undefined, help: explainChip({ kind, length }, lc) };
}
