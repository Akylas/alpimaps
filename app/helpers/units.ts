export enum UNITS {
    InchHg = 'InchHg',
    MMHg = 'MMHg',
    kPa = 'kPa',
    MM = 'mm',
    CM = 'cm',
    Percent = '%',
    Duration = 'duration',
    Date = 'date',
    Meters = 'm',
    Feet = 'ft',
    PressureHpa = 'hPa',
    Inch = 'in',
    Kilometers = 'km',
    Miles = 'mi',
    SpeedKm = 'km/h',
    MPH = 'mph',
    FPH = 'ft/h',
    SpeedM = 'm/h',
    Knot = 'kn',
    Celcius = '°C',
    Fahrenheit = '°F'
}

export enum UNIT_FAMILIES {
    Percent = 'percent',
    Distance = 'dist',
    DistanceSmall = 'distSmall',
    DistanceVerySmall = 'distVerySmall',
    Speed = 'speed',
    Pressure = 'pressure'
}

export function celsiusToFahrenheit(celsius: number) {
    return (celsius * 9) / 5 + 32;
}

export const DEFAULT_IMPERIAL_UINTS: Record<string, UNITS> = {
    [UNIT_FAMILIES.DistanceSmall]: UNITS.Inch,
    [UNIT_FAMILIES.DistanceVerySmall]: UNITS.Inch,
    [UNIT_FAMILIES.Percent]: UNITS.Percent,
    [UNIT_FAMILIES.Distance]: UNITS.Feet,
    [UNIT_FAMILIES.Speed]: UNITS.MPH,
    [UNIT_FAMILIES.Pressure]: UNITS.PressureHpa
};

export const DEFAULT_METRIC_UINTS: Record<string, UNITS> = {
    [UNIT_FAMILIES.DistanceSmall]: UNITS.CM,
    [UNIT_FAMILIES.DistanceVerySmall]: UNITS.MM,
    [UNIT_FAMILIES.Percent]: UNITS.Percent,
    [UNIT_FAMILIES.Distance]: UNITS.Meters,
    [UNIT_FAMILIES.Speed]: UNITS.SpeedKm,
    [UNIT_FAMILIES.Pressure]: UNITS.PressureHpa
};

/** What a family of units is called, the units it can be shown in and the one of a metric or an imperial setting. */
export interface UnitFamilyDefinition {
    family: string;
    title: string;
    metric: UNITS;
    imperial: UNITS;
    available: UNITS[];
}

const families = new Map<string, UnitFamilyDefinition>();

/** A feature that has figures of its own adds the family of them: its default units, and the choice the settings offer. */
export function registerUnitFamily(definition: UnitFamilyDefinition) {
    families.set(definition.family, definition);
    DEFAULT_METRIC_UINTS[definition.family] = definition.metric;
    DEFAULT_IMPERIAL_UINTS[definition.family] = definition.imperial;
}

export const unitFamilies = () => [...families.keys()];
export const unitFamily = (family: string) => families.get(family);
export const availableUnits = (family: string) => families.get(family)?.available ?? [];

// the families of the app itself
registerUnitFamily({ family: UNIT_FAMILIES.Distance, title: 'distance', metric: UNITS.Meters, imperial: UNITS.Feet, available: [UNITS.Kilometers, UNITS.Miles, UNITS.Meters, UNITS.Feet, UNITS.Inch] });
registerUnitFamily({ family: UNIT_FAMILIES.Speed, title: 'speed', metric: UNITS.SpeedKm, imperial: UNITS.MPH, available: [UNITS.SpeedKm, UNITS.SpeedM, UNITS.MPH, UNITS.FPH, UNITS.Knot] });
