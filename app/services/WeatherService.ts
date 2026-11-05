import { networkService } from '~/services/NetworkService';
import { openMeteoProvider } from '~/utils/routeAnalysis/openMeteo';
import { type WeatherProvider, WeatherProviderError, type WeatherQuery, type WeatherResponse, getWeatherProvider, registerWeatherProvider } from '~/utils/routeAnalysis/weatherProvider';

registerWeatherProvider(openMeteoProvider);

// The https disk cache keeps the answer to a url for this long, in seconds: opening a sheet then the page asks the provider once.
// An update the user asks for skips it.
const CACHE_MAX_AGE = 15 * 60;
const TIMEOUT = 30000;
// the providers are free services run by few people: say who is asking
const HEADERS = { 'User-Agent': `${__APP_ID__}/${__APP_VERSION__} (${GIT_URL})` };

class WeatherService {
    /**
     * Sends the points of the route, only when asked: never in the background. `fresh` asks the provider again whatever
     * the http cache holds. Throws `WeatherProviderError`: `offline` when there is no network to ask.
     */
    async fetch(query: WeatherQuery, { fresh = false, providerId }: { fresh?: boolean; providerId?: string } = {}): Promise<{ provider: WeatherProvider; response: WeatherResponse }> {
        const provider = getWeatherProvider(providerId);
        if (!provider) {
            throw new WeatherProviderError('error', 'no weather provider');
        }
        if (query.points.length > provider.maxPoints) {
            throw new WeatherProviderError('error', `${provider.name} takes ${provider.maxPoints} points at most`);
        }
        if (!networkService.connected) {
            throw new WeatherProviderError('offline');
        }
        const response = await provider.fetch(query, (url) =>
            networkService.request({
                url,
                method: 'GET',
                headers: { ...HEADERS, 'Cache-Control': networkService.getCacheControl(CACHE_MAX_AGE, 0, fresh) },
                timeout: TIMEOUT
            })
        );
        return { provider, response };
    }
}

export const weatherService = new WeatherService();
