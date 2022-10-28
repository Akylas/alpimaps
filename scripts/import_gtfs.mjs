import { getShapesAsGeoJSON, importGtfs, openDb } from 'gtfs';
import gtfsToGeoJSON from 'gtfs-to-geojson';
import * as fs from 'fs';
import recursive from "recursive-readdir";

const config = {
    sqlitePath: './gtfs.db',
    agencies: [
        // {
            // "agency_key": "SEM",
        //     url: 'http://www.metromobilite.fr/data/Horaires/SEM-GTFS.zip',
        //     exclude: [
        //       'calendar',
        //       'calendar_dates'
        //     ]
        // },
        {
            "agency_key": "C38",
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
// importGtfs(config)
Promise.resolve()
    // .then(() => {
        // return openDb(config)
    // })
    // .then((res) => {
    //     db = res;
    //     // return db.run('ALTER TABLE routes ADD COLUMN geojson TEXT');
    //     console.log('db opened', db)
    // })
    .then(() => {
        return gtfsToGeoJSON({...config, 
            outputType:'route',
            skipImport:true,
            outputFormat:'lines'
        });
    })
    .then(() => {
        let features =[];
        return recursive("./geojson").then(
            function(files) {
              console.log("files are", files);
              files.filter(f=>f.endsWith('.geojson')).forEach(f=>{
                  console.log('ggeojson file', f)
                const geojson = JSON.parse(fs.readFileSync(f));
                console.log('geojson', geojson.features.map(f=>f.properties.route_id))
                features = features.concat(geojson.features)
            })
    },
            function(error) {
              console.error("something exploded", error);
            }
          );
    })
    // .then((shapes) => {
    //     return Promise.all(shapes.features.map(f=>{
    //         Object.keys(f).forEach(k=>{
    //             if (k.startsWith('route'))
    //         })
    //         return db.run('UPDATE routes SET geojson = ? WHERE route_id = ?', JSON.stringify(f), f.properties.route_id)
    //     }));
    // })
    // .then((shapes) => {
    //     console.log('geosjon created', db)
    //      return db.run('DROP table shapes')
    // })
    // .then((shapes) => {
    //     console.log('geosjon created', db)
    //      return db.run('VACUUM')
    // })
    .catch((err) => {
        console.error(err);
    });
