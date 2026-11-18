import { networkService } from '~/services/NetworkService';
import type { CancelSignal } from '~/utils/routeAnalysis/pipeline';
import { openMeteoProvider } from '~/routeFeatures/weather/providers/openMeteo';
import {
    type WeatherHttp,
    type WeatherProvider,
    WeatherProviderError,
    type WeatherQuery,
    type WeatherResponse,
    getWeatherProvider,
    registerWeatherProvider
} from '~/routeFeatures/weather/providers/provider';

registerWeatherProvider(openMeteoProvider);

// The https disk cache keeps the answer to a url for this long, in seconds: opening a sheet then the page asks the provider once.
// An update the user asks for skips it.
const CACHE_MAX_AGE = 15 * 60;
const TIMEOUT = 30000;
// the providers are free services run by few people: say who is asking
const HEADERS = { 'User-Agent': `${__APP_ID__}/${__APP_VERSION__} (${GIT_URL})` };

class WeatherService {
    private requests = 0;

    /**
     * Sends the points of the route, only when asked: never in the background. `fresh` asks the provider again whatever
     * the http cache holds; `past`: the weather there was, for a ride that was done; `signal`: the request is cancelled, by its tag, when it is aborted. Throws `WeatherProviderError`: `offline` when there is no network to ask.
     */
    async fetch(
        query: WeatherQuery,
        { fresh = false, past = false, providerId, signal }: { fresh?: boolean; past?: boolean; providerId?: string; signal?: CancelSignal } = {}
    ): Promise<{ provider: WeatherProvider; response: WeatherResponse }> {
        const provider = getWeatherProvider(providerId);
        if (!provider) {
            throw new WeatherProviderError('error', 'no weather provider');
        }
        if (query.points.length > provider.maxPoints) {
            throw new WeatherProviderError('error', `${provider.name} takes ${provider.maxPoints} points at most`);
        }
        if (past && !provider.past) {
            throw new WeatherProviderError('out-of-coverage', `${provider.name} has no past weather`);
        }
        if (!networkService.connected) {
            throw new WeatherProviderError('offline');
        }
        // the runtime has no AbortController: the network layer cancels a request by its tag
        const tag = `weather-${++this.requests}`;
        signal?.onAbort(() => networkService.clearRequests(tag));
        const get: WeatherHttp = (url) =>
            networkService.request({
                url,
                tag,
                method: 'GET',
                headers: { ...HEADERS, 'Cache-Control': networkService.getCacheControl(CACHE_MAX_AGE, 0, fresh) },
                timeout: TIMEOUT
            });
        const response = past ? await provider.past(query, get) : await provider.fetch(query, get);
        return { provider, response };
    }
}

export const weatherService = new WeatherService();
