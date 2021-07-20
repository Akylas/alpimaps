import { getShapesAsGeoJSON, importGtfs, openDb } from 'gtfs';

const config = {
    sqlitePath: './gtfs.db',
    agencies: [
        // {
        //     url: 'http://www.metromobilite.fr/data/Horaires/SEM-GTFS.zip',
        //     exclude: [
        //       'calendar',
        //       'calendar_dates'
        //     ]
        // },
        {
            url: 'http://www.metromobilite.fr/data/Horaires/C38-GTFS.zip',
            exclude: [
              'calendar',
              'stop_times',
              'calendar_dates'
            ]
        }
    ]
};
let db;
importGtfs(config)
    .then(() => {
        return openDb(config)
    })
    .then((res) => {
        db = res;
        return db.run('ALTER TABLE routes ADD COLUMN geojson TEXT');
        console.log('db opened', db)
    })
    .then(() => {
        return getShapesAsGeoJSON();
    })
    .then((shapes) => {
        return Promise.all(shapes.features.map(f=>{
            return db.run('UPDATE routes SET geojson = ? WHERE route_id = ?', JSON.stringify(f), f.properties.route_id)
        }));
    })
    .then((shapes) => {
        console.log('geosjon created', db)
         return db.run('DROP table shapes')
    })
    .then((shapes) => {
        console.log('geosjon created', db)
         return db.run('VACUUM')
    })
    .catch((err) => {
        console.error(err);
    });
