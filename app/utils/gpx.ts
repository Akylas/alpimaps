import { MapBounds } from '@nativescript-community/ui-carto/core';
import { LineGeometry } from '@nativescript-community/ui-carto/geometry';
import { File, knownFolders, path } from '@nativescript/core';
import { gpx } from '@tmcw/togeojson';
import { Feature, LineString } from 'geojson';
import { DOMParser, XMLSerializer } from 'xmldom';
import { getBoundsAndDistance } from '~/helpers/geolib';
import { IItem } from '~/models/Item';
import { toXML } from 'jstoxml';

export function importGPXToGeojson(filePath: string) {
    const str = File.fromPath(path.join(knownFolders.currentApp().path, 'assets', 'gr52.gpx')).readTextSync();

    const gpxDom = new DOMParser().parseFromString(str);
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

function json2xml(o) {
    const tab = '\t';
    const toXml = function (v, name, ind) {
        let xml = '';
        if (v instanceof Array) {
            for (let i = 0, n = v.length; i < n; i++) xml += ind + toXml(v[i], name, ind + '\t') + '\n';
        } else if (typeof v == 'object') {
            let hasChild = false;
            xml += ind + '<' + name;
            for (const m in v) {
                if (m.charAt(0) === '@') {
                    xml += ' ' + m.substr(1) + '="' + v[m].toString() + '"';
                } else {
                    hasChild = true;
                }
            }
            xml += hasChild ? '>' : '/>';
            if (hasChild) {
                for (const m in v) {
                    if (m === '#text') {
                        xml += v[m];
                    } else if (m === '#cdata') {
                        xml += '<![CDATA[' + v[m] + ']]>';
                    } else if (m.charAt(0) !== '@') {
                        xml += toXml(v[m], m, ind + '\t');
                    }
                }
                xml += (xml.charAt(xml.length - 1) === '\n' ? ind : '') + '</' + name + '>';
            }
        } else {
            xml += ind + '<' + name + '>' + v.toString() + '</' + name + '>';
        }
        return xml;
    };
}
export function JSONtoXML(json) {
    return toXML(json);
}
