/** The weather's figures in the units the user chose for each family: temperature, precipitation, speed. */
import { convertFamilyValue, formatFamilyValue, unitOfFamily } from '~/helpers/formatter';
import { UNITS, UNIT_FAMILIES, registerUnitFamily } from '~/helpers/units';
import type { WeatherFormat } from '~/routeFeatures/weather/data/format';

export const TEMPERATURE_FAMILY = 'temperature';
export const PRECIPITATION_FAMILY = 'precipitation';

// the weather adds its own families of figures to the app's: the settings offer the units of each
registerUnitFamily({ family: TEMPERATURE_FAMILY, title: 'temperature', metric: UNITS.Celcius, imperial: UNITS.Fahrenheit, available: [UNITS.Celcius, UNITS.Fahrenheit] });
registerUnitFamily({ family: PRECIPITATION_FAMILY, title: 'precipitation', metric: UNITS.MM, imperial: UNITS.Inch, available: [UNITS.MM, UNITS.CM, UNITS.Inch] });

const temperatureNumber = (celsius: number) => convertFamilyValue(celsius, TEMPERATURE_FAMILY, UNITS.Celcius)[0];

export const weatherFormat: WeatherFormat = {
    temperature: (celsius, { unit = false } = {}) => (unit ? formatFamilyValue(celsius, TEMPERATURE_FAMILY, UNITS.Celcius) : `${temperatureNumber(celsius)}°`),
    temperatureRange: (low, high) => {
        const [lowValue, symbol] = convertFamilyValue(low, TEMPERATURE_FAMILY, UNITS.Celcius);
        const highValue = temperatureNumber(high);
        return lowValue === highValue ? `${lowValue} ${symbol}` : `${lowValue}–${highValue} ${symbol}`;
    },
    rain: (mm) => formatFamilyValue(mm, PRECIPITATION_FAMILY, UNITS.MM),
    rainRate: (mmPerHour) => `${formatFamilyValue(mmPerHour, PRECIPITATION_FAMILY, UNITS.MM)}/h`,
    rainNumber: (mmPerHour) => String(convertFamilyValue(mmPerHour, PRECIPITATION_FAMILY, UNITS.MM)[0]),
    speed: (kmh) => formatFamilyValue(kmh, UNIT_FAMILIES.Speed, UNITS.SpeedKm),
    speedNumber: (kmh) => String(convertFamilyValue(kmh, UNIT_FAMILIES.Speed, UNITS.SpeedKm)[0]),
    speedParts: (kmh) => {
        const [value, unit] = convertFamilyValue(kmh, UNIT_FAMILIES.Speed, UNITS.SpeedKm);
        return [String(value), unit];
    },
    rainParts: (mm) => {
        const [value, unit] = convertFamilyValue(mm, PRECIPITATION_FAMILY, UNITS.MM);
        return [String(value), unit];
    },
    rainRateParts: (mmPerHour) => {
        const [value, unit] = convertFamilyValue(mmPerHour, PRECIPITATION_FAMILY, UNITS.MM);
        return [String(value), `${unit}/h`];
    },
    temperatureRangeParts: (low, high) => {
        const [lowValue, symbol] = convertFamilyValue(low, TEMPERATURE_FAMILY, UNITS.Celcius);
        const highValue = temperatureNumber(high);
        return [lowValue === highValue ? String(lowValue) : `${lowValue}–${highValue}`, symbol];
    },
    temperatureUnit: () => (unitOfFamily(TEMPERATURE_FAMILY) === UNITS.Fahrenheit ? UNITS.Fahrenheit : UNITS.Celcius)
};

/** Changes with the units of what the weather says: what was worded in the old ones is worded again. */
export const weatherUnitsKey = () => [TEMPERATURE_FAMILY, PRECIPITATION_FAMILY, UNIT_FAMILIES.Speed].map(unitOfFamily).join();
