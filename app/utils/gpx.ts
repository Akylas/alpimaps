import { MapBounds } from '@nativescript-community/ui-carto/core';
import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
import { File, knownFolders, path } from '@nativescript/core';
import { gpx } from "@tmcw/togeojson";
import { Feature, LineString } from 'geojson';
import { DOMParser, XMLSerializer } from 'xmldom';
import { getBoundsAndDistance } from '~/helpers/geolib';
import { IItem } from '~/models/Item';
global.XMLSerializer = XMLSerializer;


export function importGPXToGeojson(filePath:string) {
    const str = File.fromPath(path.join(knownFolders.currentApp().path, 'assets', 'gr52.gpx')).readTextSync();

    const gpxDom = new DOMParser().parseFromString(str);
    const featureCollection = gpx(gpxDom)
    const itemFeature = featureCollection.features[0] as Feature<LineString>;
    return featureCollection.features.map(feature=>{
        const profile = itemFeature.properties.type || 'pedestrian';
        const data  = getBoundsAndDistance(itemFeature.geometry.coordinates)
        return  {
            type: 'Feature',
            properties: {...itemFeature.properties, 
                class: profile,
                zoomBounds: data.bounds,
                route: {
                    type: profile
                }
            },
            route:{
                totalDistance:data.distance
            },
            geometry: itemFeature.geometry,
        } as IItem
    })
}