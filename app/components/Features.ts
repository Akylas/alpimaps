import type { Point } from 'geojson';

export class PhotonFeature {
    properties: { [k: string]: any };
    public geometry!: Point;
    constructor(data) {
        const properties = data.properties || {};
        const actualName = properties.name === properties.city ? undefined : properties.name;
        const { region, name, state, street, housenumber, postcode, city, country, neighbourhood, ...actualProperties } = properties;
        actualProperties.address = {
            state,
            county: region,
            houseNumber: housenumber,
            postcode,
            city,
            country,
            street: properties['osm_key'] === 'highway' ? name : street,
            neighbourhood
        };
        actualProperties.name = actualName;
        actualProperties.provider = 'photon';
        this.properties = actualProperties;
        this.geometry = data.geometry;
    }
}
export class HereFeature {
    properties: { [k: string]: any };
    public geometry!: Point;
    constructor(data) {
        this.properties = {
            provider: 'here',
            id: data.id,
            name: data.title,
            osm_key: data.category.id ? data.category.id.split('-')[0] : undefined,
            // vicinity: data.vicinity,
            // averageRating: data.averageRating,
            categories: data.category.id.split('-'),
            address: { name: data.vicinity }
        };
        this.geometry = {
            type: 'Point',
            coordinates: data.position.reverse()
        };
    }
}
