/** How the weather says its figures: in the units the user chose. Pure: what says them in those is `ui/format`, which this stands in for. */
export interface WeatherFormat {
    /** `7°`, or with the unit `7 °C` */
    temperature(celsius: number, options?: { unit?: boolean }): string;
    /** `5–9 °C` */
    temperatureRange(low: number, high: number): string;
    /** `1.3 mm` */
    rain(mm: number): string;
    /** `1.3 mm/h` */
    rainRate(mmPerHour: number): string;
    /** The rain of an hour without its unit: `1.3` */
    rainNumber(mmPerHour: number): string;
    /** `18 km/h` */
    speed(kmh: number): string;
    /** The speed without its unit: `18` */
    speedNumber(kmh: number): string;
    /** The value and the unit apart, for what draws the unit lighter: `['18', 'km/h']` */
    speedParts(kmh: number): [string, string];
    rainParts(mm: number): [string, string];
    rainRateParts(mmPerHour: number): [string, string];
    temperatureRangeParts(low: number, high: number): [string, string];
    /** The title of a column of temperatures: `°C` */
    temperatureUnit(): string;
}

/** What metric units say; what is used when nothing chose others. */
export const METRIC_FORMAT: WeatherFormat = {
    temperature: (celsius, { unit = false } = {}) => (unit ? `${Math.round(celsius)} °C` : `${Math.round(celsius)}°`),
    temperatureRange: (low, high) => (Math.round(low) === Math.round(high) ? `${Math.round(low)} °C` : `${Math.round(low)}–${Math.round(high)} °C`),
    rain: (mm) => `${mm < 10 ? mm.toFixed(1) : Math.round(mm)} mm`,
    rainRate: (mmPerHour) => `${mmPerHour.toFixed(1)} mm/h`,
    rainNumber: (mmPerHour) => mmPerHour.toFixed(1),
    speed: (kmh) => `${Math.round(kmh)} km/h`,
    speedNumber: (kmh) => String(Math.round(kmh)),
    speedParts: (kmh) => [String(Math.round(kmh)), 'km/h'],
    rainParts: (mm) => [mm < 10 ? mm.toFixed(1) : String(Math.round(mm)), 'mm'],
    rainRateParts: (mmPerHour) => [mmPerHour.toFixed(1), 'mm/h'],
    temperatureRangeParts: (low, high) => [Math.round(low) === Math.round(high) ? String(Math.round(low)) : `${Math.round(low)}–${Math.round(high)}`, '°C'],
    temperatureUnit: () => '°C'
};
