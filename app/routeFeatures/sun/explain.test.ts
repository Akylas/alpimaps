import { describe, expect, it } from 'vitest';
import { explainChip } from '~/routeFeatures/sun/explain';

const say = (key: string, ...args: string[]) => `${key}(${args.join(',')})`;

describe('explainChip', () => {
    it('says what a time is, and where on the ride it falls when the ride is out at it', () => {
        expect(explainChip({ kind: 'sunset', time: '8:43 PM', relation: 'during', where: '382 m' }, say)).toBe('sun_chip_sunset(8:43 PM) · sun_chip_during(382 m)');
    });

    it('says how long before the start or after the end an event is', () => {
        expect(explainChip({ kind: 'moonrise', time: '8:56 PM', relation: 'before', where: '18 min' }, say)).toBe('sun_chip_moonrise(8:56 PM) · sun_chip_before(18 min)');
        expect(explainChip({ kind: 'sunrise', time: '6:26 AM', relation: 'after', where: '2 h' }, say)).toBe('sun_chip_sunrise(6:26 AM) · sun_chip_after(2 h)');
    });

    it('says what a length is, with nothing of where', () => {
        expect(explainChip({ kind: 'dark', length: '1 h 26 min' }, say)).toBe('sun_chip_dark(1 h 26 min)');
        expect(explainChip({ kind: 'moonlit', length: '52 min' }, say)).toBe('sun_chip_moonlit(52 min)');
        expect(explainChip({ kind: 'glare', length: '2.1 km' }, say)).toBe('sun_chip_glare(2.1 km)');
    });

    it('says what the lit part of the moon is', () => {
        expect(explainChip({ kind: 'moon', length: '100 %' }, say)).toBe('sun_chip_moon(100 %)');
    });
});
