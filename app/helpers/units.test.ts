import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPERIAL_UINTS, DEFAULT_METRIC_UINTS, UNITS, UNIT_FAMILIES, availableUnits, celsiusToFahrenheit, registerUnitFamily, unitFamilies } from './units';

describe('celsiusToFahrenheit', () => {
    it('converts', () => {
        expect(celsiusToFahrenheit(0)).toBe(32);
        expect(celsiusToFahrenheit(100)).toBe(212);
        expect(celsiusToFahrenheit(-40)).toBe(-40);
    });
});

describe('unit families', () => {
    it('knows the families of the app and the units each can be shown in', () => {
        expect(unitFamilies()).toContain(UNIT_FAMILIES.Distance);
        expect(availableUnits(UNIT_FAMILIES.Speed)).toEqual([UNITS.SpeedKm, UNITS.SpeedM, UNITS.MPH, UNITS.FPH, UNITS.Knot]);
    });

    it('lets a feature add a family of its own, with its metric and imperial unit', () => {
        registerUnitFamily({ family: 'temp', title: 'temperature', metric: UNITS.Celcius, imperial: UNITS.Fahrenheit, available: [UNITS.Celcius, UNITS.Fahrenheit] });
        expect(DEFAULT_METRIC_UINTS.temp).toBe(UNITS.Celcius);
        expect(DEFAULT_IMPERIAL_UINTS.temp).toBe(UNITS.Fahrenheit);
        expect(availableUnits('temp')).toEqual([UNITS.Celcius, UNITS.Fahrenheit]);
        expect(unitFamilies()).toContain('temp');
    });

    it('keeps a family registered twice once', () => {
        registerUnitFamily({ family: 'prec', title: 'precipitation', metric: UNITS.MM, imperial: UNITS.Inch, available: [UNITS.MM, UNITS.Inch] });
        registerUnitFamily({ family: 'prec', title: 'precipitation', metric: UNITS.MM, imperial: UNITS.Inch, available: [UNITS.MM, UNITS.Inch] });
        expect(unitFamilies().filter((family) => family === 'prec')).toHaveLength(1);
    });
});
