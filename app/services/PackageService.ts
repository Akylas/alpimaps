import { File, Folder, knownFolders, path } from 'tns-core-modules/file-system';
import { CartoPackageManager, CartoPackageManagerListener, PackageErrorType, PackageManagerTileDataSource, PackageStatus } from 'nativescript-carto/packagemanager/packagemanager';
import { MBVectorTileDecoder } from 'nativescript-carto/vectortiles/vectortiles';
import { Observable } from 'tns-core-modules/data/observable/observable';
import { VectorTileSearchService } from 'nativescript-carto/search/search';
import { OrderedTileDataSource, TileDataSource } from 'nativescript-carto/datasources/datasource';
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { CartoOnlineTileDataSource } from 'nativescript-carto/datasources/cartoonline';
import { CartoOnlineVectorTileLayer } from 'nativescript-carto/layers/vector';
import { CartoMapStyle } from 'nativescript-carto/core/core';
import { getDataFolder } from '~/utils';

export type PackageType = 'geo' | 'routing' | 'map';
const docPath = getDataFolder();

class PackageManagerListener implements CartoPackageManagerListener {
    constructor(private type: PackageType, public superThis: PackageService) {}
    onPackageCancelled(id: string, version: number) {
        this.superThis.onPackageCancelled(this.type, id, version);
    }
    onPackageFailed(arg1: string, version: number, errorType: PackageErrorType) {
        this.superThis.onPackageFailed(this.type, arg1, version, errorType);
    }
    onPackageListFailed() {
        this.superThis.onPackageListFailed(this.type);
    }
    onPackageListUpdated() {
        this.superThis.onPackageListUpdated(this.type);
    }
    onPackageStatusChanged(arg1: string, version: number, status: PackageStatus) {
        this.superThis.onPackageStatusChanged(this.type, arg1, version, status);
    }
    onPackageUpdated(arg1: string, version: number) {
        this.superThis.onPackageUpdated(this.type, arg1, version);
    }
    // onStyleFailed?(styleName: string) {
    //     this.superThis.onStyleFailed(this.type, styleName);
    // }
    // onStyleUpdated?(styleName: string) {
    //     this.superThis.onStyleUpdated(this.type, styleName);
    // }
}
export default class PackageService extends Observable {
    dataFolder = Folder.fromPath(path.join(docPath, 'packages'));
    geoDataFolder = Folder.fromPath(path.join(docPath, 'geocodingpackages'));
    routingDataFolder = Folder.fromPath(path.join(docPath, 'routingpackages'));
    _packageManager: CartoPackageManager;
    _geoPackageManager: CartoPackageManager;
    _routingPackageManager: CartoPackageManager;
    dataSource: TileDataSource<any, any>;
    vectorTileDecoder: MBVectorTileDecoder;
    downloadingPackages: { [k: string]: number } = {};
    constructor() {
        super();

        // this.packageManager.start();
    }

    get packageManager() {
        if (!this._packageManager) {
            console.log('creating package manager', this.dataFolder.path);
            this._packageManager = new CartoPackageManager({
                source: 'carto.streets',
                dataFolder: this.dataFolder.path,
                listener: new PackageManagerListener('map', this)
            });
        }
        return this._packageManager;
    }
    get geoPackageManager() {
        if (!this._geoPackageManager) {
            console.log('creating geo package manager', this.geoDataFolder.path);
            this._geoPackageManager = new CartoPackageManager({
                source: 'geocoding:carto.streets',
                dataFolder: this.geoDataFolder.path,
                listener: new PackageManagerListener('geo', this)
            });
        }
        return this._geoPackageManager;
    }
    get routingPackageManager() {
        if (!this._routingPackageManager) {
            console.log('creating routing package manager', this.routingDataFolder.path);
            this._routingPackageManager = new CartoPackageManager({
                source: 'routing:carto.streets',
                dataFolder: this.routingDataFolder.path,
                listener: new PackageManagerListener('routing', this)
            });
        }
        return this._routingPackageManager;
    }
    start() {
        const managerStarted = this.packageManager.start();
        const geoManagerStarted = this.geoPackageManager.start();
        const routingManagerStarted = this.routingPackageManager.start();
        console.log('start packageManager', managerStarted, this._packageManager.getLocalPackages().size());
        console.log('start geoPackageManager', geoManagerStarted, this._geoPackageManager.getLocalPackages().size());
        console.log('start routingPackageManager', routingManagerStarted, this._routingPackageManager.getLocalPackages().size());
    }
    onPackageListUpdated = (type: PackageType) => {
        this.notify({ eventName: 'onPackageListUpdated', type, object: this });
        // console.log('onPackageListUpdated', type);
    }
    onPackageStatusChanged = (type: PackageType, id: string, version: number, status: PackageStatus) => {
        const key = type + '_' + id;
        this.downloadingPackages[key] = status.getProgress();
        this.updateTotalProgress();
        this.notify({
            eventName: 'onPackageStatusChanged',
            object: this,
            type,
            data: {
                id,
                version,
                status
            }
        });
        // console.log('onPackageStatusChanged', id, version, status.getProgress());
    }
    updateTotalProgress() {
        const keys = Object.keys(this.downloadingPackages);
        let totalProgress = keys.reduce((result, k) => (result += this.downloadingPackages[k]), 0);
        totalProgress /= keys.length;
        this.notify({
            eventName: 'onProgress',
            object: this,
            data: totalProgress
        });
    }
    onPackageCancelled = (type: PackageType, id: string, version: number) => {
        const key = type + '_' + id;
        delete this.downloadingPackages[key];
        this.updateTotalProgress();
        // console.log('onPackageCancelled', id, version);
        this.notify({
            eventName: 'onPackageCancelled',
            object: this,
            type,
            data: {
                id,
                version
            }
        });
    }

    onPackageFailed = (type: PackageType, id: string, version: number, errorType: PackageErrorType) => {
        const key = type + '_' + id;
        delete this.downloadingPackages[key];
        this.updateTotalProgress();
        this.notify({
            eventName: 'onPackageFailed',
            object: this,
            type,
            data: {
                id,
                version,
                errorType
            }
        });
        // console.log('onPackageFailed', id, version, errorType);
    }

    onPackageListFailed = (type: PackageType) => {
        // console.log('onPackageListFailed');
        this.notify({ eventName: 'onPackageListFailed', type, object: this });
    }

    onPackageUpdated = (type: PackageType, id: string, version: number) => {
        const key = type + '_' + id;
        delete this.downloadingPackages[key];
        this.updateTotalProgress();
        // console.log('onPackageFailed', id, version);
        this.notify({
            eventName: 'onPackageUpdated',
            object: this,
            type,
            data: {
                id,
                version
            }
        });
    }

    getDataSource() {
        if (!this.dataSource) {
            const cacheFolder = File.fromPath(path.join(docPath, 'carto.db'));
            console.log('create main vector datasource', cacheFolder.path);
            this.dataSource = new OrderedTileDataSource({
                dataSources: [
                    new PackageManagerTileDataSource({
                        packageManager: this.packageManager
                    }),
                    new PersistentCacheTileDataSource({
                        dataSource: new CartoOnlineTileDataSource({
                            source: 'carto.streets'
                        }),
                        capacity: 100 * 1024 * 1024,
                        databasePath: cacheFolder.path
                    })
                ]
            });
        }
        return this.dataSource;
    }
    // getCartoCss() {
    //     return Folder.fromPath(path.join(knownFolders.currentApp().path, 'assets'))
    //         .getFile('style.mss')
    //         .readTextSync();
    // }
    getVectorTileDecoder(style: string = 'voyager') {
        console.log('querying', 'vectorTileDecoder');
        if (!this.vectorTileDecoder) {
            // console.log('cartoCss', cartoCss);
            // this.vectorTileDecoder = new MBVectorTileDecoder({
            //     style,
            //     // dirPath: '~/assets/styles/test1'
            //     zipPath: '~/assets/styles/carto.zip'
            // });
            this.vectorTileDecoder = new CartoOnlineVectorTileLayer({ style: CartoMapStyle.VOYAGER }).getTileDecoder();
        }
        return this.vectorTileDecoder;
    }
}
