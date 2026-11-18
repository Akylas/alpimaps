import { File } from '@nativescript/core';
import { gpx } from '@tmcw/togeojson';
import { Feature, LineString } from 'geojson';
import { toXML } from 'jstoxml';
import { DOMParser } from '@xmldom/xmldom';
import { getBoundsAndDistance } from '~/helpers/geolib';
import { IItem } from '~/models/Item';
import { recordedFromGpx } from '~/utils/routeAnalysis/recorded';
import { withRecording } from '~/utils/routeAnalysis/storage';

export function importGPXToGeojson(filePath: string) {
    const str = File.fromPath(filePath).readTextSync();

    const gpxDom = new DOMParser().parseFromString(str, 'application/xml');
    const featureCollection = gpx(gpxDom);
    const itemFeature = featureCollection.features[0] as Feature<LineString>;
    return featureCollection.features.map((feature) => {
        if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
            const profile = feature.properties.type || 'pedestrian';
            const data = getBoundsAndDistance(feature.geometry.coordinates);
            // the times of the points are kept as the recording, not as a property of the item
            const { coordinateProperties, ...properties } = feature.properties;
            const vertexCount = feature.geometry.type === 'LineString' ? feature.geometry.coordinates.length : feature.geometry.coordinates.flat().length;
            const recorded = recordedFromGpx({ coordinateProperties }, vertexCount, Date.now());
            return {
                type: 'Feature',
                ...(recorded ? { analysis: withRecording(null, feature.geometry, recorded) } : {}),
                properties: {
                    ...properties,
                    class: profile,
                    zoomBounds: data.bounds,
                    route: {
                        type: profile
                    }
                },
                route: {
                    totalDistance: data.distance
                },
                geometry: feature.geometry
            } as IItem;
        } else if (feature.geometry.type === 'Point') {
            return feature as IItem;
        }
    });
}

export function JSONtoXML(json) {
    return toXML(json) as string;
}
