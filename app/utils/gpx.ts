import { File } from '@nativescript/core';
import { gpx } from '@tmcw/togeojson';
import { Feature, LineString } from 'geojson';
import { toXML } from 'jstoxml';
import { DOMParser } from '@xmldom/xmldom';
import { getBoundsAndDistance } from '~/helpers/geolib';
import { IItem } from '~/models/Item';

export function importGPXToGeojson(filePath: string) {
    const str = File.fromPath(filePath).readTextSync();

    const gpxDom = new DOMParser().parseFromString(str);
    DEV_LOG && console.log('importGPXToGeojson', gpxDom);
    const featureCollection = gpx(gpxDom);
    const itemFeature = featureCollection.features[0] as Feature<LineString>;
    return featureCollection.features.map((feature) => {
        if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
            const profile = itemFeature.properties.type || 'pedestrian';
            const data = getBoundsAndDistance(itemFeature.geometry.coordinates);
            return {
                type: 'Feature',
                properties: {
                    ...itemFeature.properties,
                    class: profile,
                    zoomBounds: data.bounds,
                    route: {
                        type: profile
                    }
                },
                route: {
                    totalDistance: data.distance
                },
                geometry: itemFeature.geometry
            } as IItem;
        } else if (feature.geometry.type === 'Point') {
            return itemFeature as IItem;
        }
    });
}

export function JSONtoXML(json) {
    return toXML(json) as string;
}
