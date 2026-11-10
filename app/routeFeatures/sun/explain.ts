/** What a chip of the sun says, in words, for the one who taps it. Pure: nothing here may import NativeScript. */

export type SunChipKind = 'sunrise' | 'sunset' | 'dusk' | 'moonrise' | 'moonset' | 'dark' | 'moonlit' | 'glare' | 'moon';

export interface SunChipFacts {
    kind: SunChipKind;
    /** the time of an event, as the chip says it */
    time?: string;
    /** the length, the distance or the share the chip says */
    length?: string;
    /** where an event is against the ride, and how far: a distance from the start, or a time before it or after the end */
    relation?: 'during' | 'before' | 'after';
    where?: string;
}

/** The chips say a figure and an icon: this is the rest, `say` translating the keys `sun_chip_<kind>` and `sun_chip_<relation>`. */
export function explainChip({ kind, length, relation, time, where }: SunChipFacts, say: (key: string, ...args: string[]) => string): string {
    const what = say(`sun_chip_${kind}`, time ?? length ?? '');
    return relation && where ? `${what} · ${say(`sun_chip_${relation}`, where)}` : what;
}
