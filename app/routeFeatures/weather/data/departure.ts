/** What the forecast says of a ride leaving at a time, for the When panel's strip. Pure: nothing here may import NativeScript. */
import type { DepartureAssessment } from '~/routeFeatures/registry';
import type { WeatherRead } from '~/routeFeatures/weather/data/read';
import { METRIC_FORMAT, type WeatherFormat } from '~/routeFeatures/weather/data/format';
import { RAIN_BAR_MAX, RAIN_BLUE } from '~/routeFeatures/weather/ui/colors';
import { skyId } from '~/routeFeatures/weather/ui/pageRows';

/** points for a millimeter of rain on the ride, and for the whole way against the wind */
const RAIN_POINTS_PER_MM = 3;
const HEADWIND_POINTS = 2;

/** share of the way against the wind from which a ride is marked windy: the sky, which marks every ride, says the rest */
const WINDY_SHARE = 0.25;
/** mm of rain over the ride from which its figure is a figure, not a dash */
const RAINY_MM = 0.1;

/**
 * The ride read for a departure as the forecast has it. Covered when the hours fetched include the whole ride: a ride they do not
 * reach scores nothing and is marked by nothing.
 */
export function weatherAssessment(read: Pick<WeatherRead, 'ride' | 'summary'> | null, format: WeatherFormat = METRIC_FORMAT): DepartureAssessment | undefined {
    if (!read) {
        return undefined;
    }
    if (!read.ride.every((entry) => !!entry.reading)) {
        return { points: {}, indicators: [], covered: false };
    }
    const { headShare, rainTotal } = read.summary;
    return {
        points: { rain: rainTotal * RAIN_POINTS_PER_MM, wind: headShare * HEADWIND_POINTS },
        // the sky first: every ride has one
        indicators: [skyId(read.summary), ...(headShare >= WINDY_SHARE ? ['wind'] : [])],
        covered: true,
        // the rain of the ride, as a number and a bar
        figure: rainTotal >= RAINY_MM ? { text: format.rainNumber(rainTotal), share: Math.min(1, rainTotal / RAIN_BAR_MAX), color: RAIN_BLUE } : { text: '–' }
    };
}

/** A forecast was fetched, and the ride read for this departure is not in the hours it holds: it has to be fetched again. Not before one was asked for. */
export function weatherNeedsFetch(read: Pick<WeatherRead, 'ride'> | null): boolean {
    return !!read && !read.ride.every((entry) => !!entry.reading);
}
