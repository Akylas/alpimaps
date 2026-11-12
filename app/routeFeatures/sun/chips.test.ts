import { describe, expect, it, vi } from 'vitest';

vi.mock('~/helpers/formatter', () => ({
    formatDistance: (meters: number) => `${meters} m`,
    formatDuration: (seconds: number) => `${seconds} s`
}));
vi.mock('~/helpers/locale', () => ({
    lc: (key: string, ...args: string[]) => `${key}(${args.join(',')})`
}));

import { eventChip, figureChip } from '~/routeFeatures/sun/chips';
import { SUN_EVENTS } from '~/routeFeatures/sun/colors';

const clock = (at: number) => `t${at}`;

describe('eventChip', () => {
    it('says the time of the event in its icon and colour, and the distance where the ride is out at it', () => {
        const chip = eventChip({ id: 'sunset', at: 5, relation: 'during', distance: 382 }, clock);
        expect(chip).toEqual({
            key: 'sunset',
            icon: SUN_EVENTS.sunset.icon,
            color: SUN_EVENTS.sunset.color,
            text: 't5',
            help: 'sun_chip_sunset(t5) · sun_chip_during(382 m)'
        });
    });

    it('says how long before the start or after the end the event is', () => {
        expect(eventChip({ id: 'moonrise', at: 7, relation: 'before', ms: 18000 }, clock).help).toBe('sun_chip_moonrise(t7) · sun_chip_before(18 s)');
        expect(eventChip({ id: 'sunrise', at: 9, relation: 'after', ms: 2000 }, clock).help).toBe('sun_chip_sunrise(t9) · sun_chip_after(2 s)');
    });
});

describe('figureChip', () => {
    it('says how long the dark and the moonlight last, in their colours', () => {
        expect(figureChip('dark', 5160000)).toEqual({ key: 'dark', icon: SUN_EVENTS.dark.icon, color: SUN_EVENTS.dark.color, text: '5160 s', help: 'sun_chip_dark(5160 s)' });
        expect(figureChip('moonlit', 3000000).text).toBe('3000 s');
    });

    it('says how far the glare lasts, as an alert with no colour', () => {
        expect(figureChip('glare', 2100)).toEqual({ key: 'glare', icon: SUN_EVENTS.glare.icon, color: undefined, alert: true, text: '2100 m', help: 'sun_chip_glare(2100 m)' });
    });
});
