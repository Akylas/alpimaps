import { networkService } from '~/services/NetworkService';

@JavaProxy('akylas.alpi.maps.WeatherReceiver')
@NativeClass
export class WeatherReceiver extends android.content.BroadcastReceiver {
    public onReceive(context: android.content.Context, intent: android.content.Intent) {
        if (intent.getAction() === 'com.akylas.weather.QUERY_WEATHER_RESULT') {
            const id = intent.getStringExtra('id');
            const weather = JSON.parse(intent.getStringExtra('weather'));
            const error = intent.getStringExtra('error');
            networkService.onWeatherResultBroadcast(id, weather, error);
            return;
        }
    }
}
