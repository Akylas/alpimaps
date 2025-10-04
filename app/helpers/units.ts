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
    Knot = 'kn'
}

export enum UNIT_FAMILIES {
    Percent = 'percent',
    Distance = 'dist',
    DistanceSmall = 'distSmall',
    DistanceVerySmall = 'distVerySmall',
    Speed = 'speed',
    Pressure = 'pressure'
}

export const DEFAULT_IMPERIAL_UINTS = {
    [UNIT_FAMILIES.DistanceSmall]: UNITS.Inch,
    [UNIT_FAMILIES.DistanceVerySmall]: UNITS.Inch,
    [UNIT_FAMILIES.Percent]: UNITS.Percent,
    [UNIT_FAMILIES.Distance]: UNITS.Feet,
    [UNIT_FAMILIES.Speed]: UNITS.MPH,
    [UNIT_FAMILIES.Pressure]: UNITS.PressureHpa
};

export const DEFAULT_METRIC_UINTS = {
    [UNIT_FAMILIES.DistanceSmall]: UNITS.CM,
    [UNIT_FAMILIES.DistanceVerySmall]: UNITS.MM,
    [UNIT_FAMILIES.Percent]: UNITS.Percent,
    [UNIT_FAMILIES.Distance]: UNITS.Meters,
    [UNIT_FAMILIES.Speed]: UNITS.SpeedKm,
    [UNIT_FAMILIES.Pressure]: UNITS.PressureHpa
};
