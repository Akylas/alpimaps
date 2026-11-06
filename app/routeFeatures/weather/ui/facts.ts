/** The figures of a weather summary, as the chips of the weather card, the section header and the insight row. Pure: nothing here may import NativeScript. */
import type { LensFact } from '~/routeFeatures/registry';
import type { WeatherFormat } from '~/routeFeatures/weather/data/format';
import type { WeatherSummary } from '~/routeFeatures/weather/data/read';
import { HEADWIND_HARD_COLOR, cloudTint, rainColor, rainTint, tempColor, tint } from '~/routeFeatures/weather/ui/colors';

/** What says the facts in words and units: the app's own, or a stand-in. */
export interface FactsWords {
    format: WeatherFormat;
    t: (key: string, ...args: string[]) => string;
    distance: (meters: number) => string;
}

/** mm of rain over the ride under which there is nothing to say of it */
const RAINY_MM = 0.1;
/** share of the way against the wind from which the chip is a warning, and from which it is there at all */
const HEADWIND_WARN = 0.3;
const HEADWIND_SHOWN = 0.1;

/** The summary as chips, the figures that matter in the colour and the wash of what they are about; what has nothing to say is left out. */
export function summaryFacts(summary: WeatherSummary, { format, t }: FactsWords): LensFact[] {
    const facts: LensFact[] = [];
    const { cloud, headShare, rainPeak, rainTotal, tempMax, tempMin, thunder } = summary;
    if (tempMin !== undefined) {
        // as oss-weather says a day: the high in bold, the low lighter after it
        const high = format.temperature(tempMax);
        const low = format.temperature(tempMin);
        const range = high !== low;
        facts.push({ icon: 'mdi-thermometer', text: range ? `${high} / ${low}` : high, value: high, ...(range ? { unit: `/ ${low}` } : {}), color: tempColor(tempMin <= 0 ? tempMin : tempMax) });
    }
    if (rainPeak && rainTotal >= RAINY_MM) {
        const [value, unit] = format.rainParts(rainTotal);
        // the bar is the chance of the rain, when the forecast says
        facts.push({
            icon: 'mdi-water',
            text: `${value} ${unit}`,
            value,
            unit,
            color: rainColor(rainPeak.mmPerHour),
            tint: rainTint(rainPeak.mmPerHour),
            ...(rainPeak.probability === undefined ? {} : { bar: rainPeak.probability / 100 })
        });
    }
    if (cloud !== undefined) {
        const value = String(Math.round(cloud));
        facts.push({ icon: 'mdi-cloud-outline', text: `${value} %`, value, unit: '%', tint: cloudTint(cloud) });
    }
    if (headShare >= HEADWIND_SHOWN) {
        const value = String(Math.round(headShare * 100));
        const warn = headShare >= HEADWIND_WARN;
        facts.push({
            icon: 'mdi-weather-windy',
            text: `${value} %`,
            value,
            unit: '%',
            label: t('weather_stat_headwind'),
            ...(warn ? { color: HEADWIND_HARD_COLOR, tint: tint(HEADWIND_HARD_COLOR, 0.16) } : {})
        });
    }
    if (thunder) {
        facts.push({ icon: 'mdi-weather-lightning', text: t('weather_thunder'), alert: true });
    }
    return facts;
}

/** The heaviest rain as a sentence, where it is and how likely: too long for a chip. None for a dry ride. */
export function rainPeakSentence({ rainPeak, rainTotal }: Pick<WeatherSummary, 'rainPeak' | 'rainTotal'>, { distance, format, t }: FactsWords): string | undefined {
    if (!rainPeak || rainTotal < RAINY_MM) {
        return undefined;
    }
    // the string has its own `/h`
    const sentence = t('weather_rain_around', format.rain(rainPeak.mmPerHour), distance(rainPeak.distance));
    return rainPeak.probability === undefined ? sentence : `${sentence} · ${Math.round(rainPeak.probability)} %`;
}
