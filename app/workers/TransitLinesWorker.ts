import '@nativescript/core/globals';
import { BaseWorker, WorkerEvent } from '@akylas/nativescript-app-utils/worker/BaseWorker';
import { geometryBounds } from '~/utils/geo';

// try {
//     const test = require('~/services/pdf/PDFExportCanvas');
// } catch (error) {
//     console.error(error, error.stack);
// }

const context: Worker = self as any;
const TAG = '[TransitLinesWorker]';

DEV_LOG && console.log('TransitLinesWorker');
class TransitLinesWorker extends BaseWorker {
    receivedMessage(event: WorkerEvent) {
        const data = event.data;
        const { id, type } = data;
        DEV_LOG && console.log(TAG, 'receivedMessage', type);
        try {
            switch (type) {
                case 'getTransitLines':
                    const { metroData, transitLines } = data.messageData;
                    // TODO do that in a thread / worker
                    const featureCollection = JSON.parse(transitLines);
                    const metroDataJSON = JSON.parse(metroData);
                    const features = featureCollection.features;
                    for (let index = features.length - 1; index >= 0; index--) {
                        const f = features[index];
                        const key = f.properties.id.replace('_', ':');
                        const d = metroDataJSON[key];
                        DEV_LOG && console.log('test', f.properties.id, key, !!d);
                        if (d) {
                            Object.assign(f.properties, {
                                route_id: f.properties.id,
                                route_mode: d.mode,
                                route_short_name: d.shortName,
                                route_long_name: d.longName,
                                shortName: d.shortName,
                                longName: d.longName,
                                name: d.longName,
                                route_color: d.color,
                                route_text_color: d.textColor,
                                color: d.color,
                                textColor: d.textColor
                            });

                            if (f.geometry && !f.geometry.type) {
                                f.geometry = null;
                            } else {
                                // plain arithmetic on the GeoJSON: this worker no longer loads the
                                // SDK at all, which is what it was doing to read one bounding box
                                const bounds = geometryBounds(f.geometry);
                                if (bounds) {
                                    f.properties.extent = [bounds.southwest.lon, bounds.southwest.lat, bounds.northeast.lon, bounds.northeast.lat];
                                }
                            }
                        } else {
                            features.splice(index, 1);
                        }
                    }
                    (global as any).postMessage({ id, type, messageData: JSON.stringify(featureCollection) });
                    break;
            }
        } catch (error) {
            (global as any).postMessage({ id, type, error: JSON.stringify({ message: error.toString(), stack: error.stack, stackTrace: error.stackTrace }) });
        }
    }
}
const worker = new TransitLinesWorker(context);
