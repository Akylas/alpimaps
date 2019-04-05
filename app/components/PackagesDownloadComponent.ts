import BaseVueComponent from './BaseVueComponent';
import { Component } from 'vue-property-decorator';
import { CartoPackageManager, PackageAction, PackageInfo, PackageInfoVector, PackageStatus } from 'nativescript-carto/packagemanager/packagemanager';
import { ObservableArray } from 'tns-core-modules/data/observable-array/observable-array';
import { ItemEventData } from 'tns-core-modules/ui/list-view';
import { isAndroid } from 'tns-core-modules/platform';
import { PackageType } from '~/services/PackageService';

const mapLanguages = ['en', 'de', 'es', 'it', 'fr', 'ru'];

class Package {
    id: string;
    geoStatus: PackageStatus;
    routingStatus: PackageStatus;
    public name: string;
    public info?: PackageInfo;
    public status?: PackageStatus;
    public geoInfo?: PackageInfo;
    public routingInfo?: PackageInfo;

    constructor(options: { name: string; info?: PackageInfo; status?: PackageStatus; geoStatus?: PackageStatus; routingStatus?: PackageStatus; geoInfo?: PackageInfo; routingInfo?: PackageInfo }) {
        this.name = options.name;
        this.info = options.info;
        this.status = options.status;
        this.geoStatus = options.geoStatus;
        this.routingStatus = options.routingStatus;
        this.geoInfo = options.geoInfo;
        this.routingInfo = options.routingInfo;
        this.id = this.info != null ? this.info.getPackageId() : null;
    }

    compare(s: Package, t: Package) {
        return s.name === t.name;
    }

    isCustomRegionFolder() {
        return this.name === Package.CUSTOM_REGION_FOLDER_NAME;
    }

    isCustomRegionPackage() {
        if (!this.id ) {
            return false;
        }

        return this.id.indexOf(Package.BBOX_IDENTIFIER) !== -1;
    }
    hasGeo() {
        return !!this.geoInfo;
    }
    hasRouting() {
        return !!this.routingInfo;
    }
    isGroup() {
        // Custom region packages will have status & info == null, but they're not groups
        return this.status == null && this.info == null && !this.isCustomRegionPackage();
    }

    getStatusText() {
        if (this.isGroup()) {
            return;
        }
        let status = '';

        status += this.getVersionAndSize();

        if (!!this.status) {
            const action = this.status.getCurrentAction();

            if (action === PackageAction.READY) {
                status = 'Ready';
            } else if (action === PackageAction.WAITING) {
                status = 'Queued';
            } else {
                if (action === PackageAction.COPYING) {
                    status = 'Copying';
                } else if (action === PackageAction.DOWNLOADING) {
                    status = 'Downloading';
                } else if (action === PackageAction.REMOVING) {
                    status = 'Removing';
                }

                status += ' ' + this.status.getProgress() + '%';
            }
        }

        return status;
    }

    static getSizeInMb(info: PackageInfo) {
        return (info.getSize() / (1024 * 1024)).toFixed();
    }

    static isSmallerThan1MB(info: PackageInfo) {
        return info.getSize() < 1024 * 1024;
    }

    static getInfoSizeLabel(info: PackageInfo) {
        const size = Package.getSizeInMb(info);
        let result = size + ' MB';
        if (Package.isSmallerThan1MB(info)) {
            result = '<1MB';
        }
        return result;
    }

    getVersionAndSize() {
        if (this.isCustomRegionPackage()) {
            return '';
        }

        const version = this.info.getVersion();
        const size = Package.getSizeInMb(this.info);

        let result = ' v.' + version + ' (' + Package.getInfoSizeLabel(this.info);

        if (this.geoInfo) {
            result += ',geo:' + Package.getInfoSizeLabel(this.geoInfo);
        }

        if (this.routingInfo) {
            result += ',routing:' + Package.getInfoSizeLabel(this.routingInfo);
        }

        return result + ')';
    }
    static isDownloading(status: PackageStatus) {
        if (!status) {
            return false;
        }

        return status.getCurrentAction() === PackageAction.DOWNLOADING && !status.isPaused();
    }
    isDownloading() {
        return Package.isDownloading(this.routingStatus) || Package.isDownloading(this.geoStatus) || Package.isDownloading(this.status);
    }
    static getDownloadProgress(status: PackageStatus) {
        if (!status) {
            return 0;
        }
        return status.getProgress();
    }
    getDownloadProgress() {
        if (Package.isDownloading(this.routingStatus)) {
            return Package.getDownloadProgress(this.routingStatus);
        }
        if (Package.isDownloading(this.geoStatus)) {
            return Package.getDownloadProgress(this.geoStatus);
        }
        return Package.getDownloadProgress(this.status);
    }

    // isQueued() {
    //     if (this.status == null) {
    //         return false;
    //     }

    //     return this.status.getCurrentAction() == PackageAction.WAITING && !this.status.isPaused();
    // }

    static ACTION_PAUSE = 'PAUSE';
    static ACTION_RESUME = 'RESUME';
    static ACTION_CANCEL = 'CANCEL';
    static ACTION_DOWNLOAD = 'DOWNLOAD';
    static ACTION_GEO_DOWNLOAD = 'GEO';
    static ACTION_ROUTING_DOWNLOAD = 'ROUTING';
    static ACTION_REMOVE = 'REMOVE';

    static CUSTOM_REGION_FOLDER_NAME = 'CUSTOM REGION';
    static BBOX_IDENTIFIER = 'bbox(';

    getActionText(type: PackageType) {
        let status: PackageStatus;
        switch (type) {
            case 'geo':
                status = this.geoStatus;
                break;
            case 'routing':
                status = this.routingStatus;
                break;
            default:
                status = this.status;
        }
        if (status == null) {
            return Package.ACTION_DOWNLOAD;
        }

        const action = status.getCurrentAction();
        // console.log('getActionText', action, PackageAction.READY);

        if (action === PackageAction.READY) {
            return Package.ACTION_REMOVE;
        } else if (action === PackageAction.WAITING) {
            return Package.ACTION_CANCEL;
        }

        if (status.isPaused()) {
            return Package.ACTION_RESUME;
        } else {
            return Package.ACTION_PAUSE;
        }
    }

    getGeoActionText() {
        const status = this.geoStatus;
        if (!status) {
            return Package.ACTION_GEO_DOWNLOAD;
        }

        const action = status.getCurrentAction();
        // console.log('getActionText', action, PackageAction.READY);

        if (action === PackageAction.READY) {
            return Package.ACTION_REMOVE;
        } else if (action === PackageAction.WAITING) {
            return Package.ACTION_CANCEL;
        }

        if (status.isPaused()) {
            return Package.ACTION_RESUME;
        } else {
            return Package.ACTION_PAUSE;
        }
    }

    getRoutingActionText() {
        const status = this.routingStatus;
        if (!status) {
            return Package.ACTION_ROUTING_DOWNLOAD;
        }

        const action = status.getCurrentAction();
        // console.log('getActionText', action, PackageAction.READY);

        if (action === PackageAction.READY) {
            return Package.ACTION_REMOVE;
        } else if (action === PackageAction.WAITING) {
            return Package.ACTION_CANCEL;
        }

        if (status.isPaused()) {
            return Package.ACTION_RESUME;
        } else {
            return Package.ACTION_PAUSE;
        }
    }
}
@Component({})
export default class PackagesDownloadComponent extends BaseVueComponent {
    dataItems: ObservableArray<Package> = new ObservableArray([] as any);
    loading = true;
    currentFolder = ''; // Current 'folder' of the package, for example "Asia/"
    constructor() {
        super();
    }
    mounted() {
        super.mounted();
        // this.dataItems = new ObservableArray([] as any);
        // console.log('package view mounted');
        // setTimeout(() => {
        const packageService = this.$packageService;
        packageService.on('onPackageListUpdated', this.onPackageListUpdated);
        packageService.on('onPackageListFailed', this.onPackageListFailed);
        packageService.on('onPackageStatusChanged', this.onPackageStatusChanged);
        packageService.on('onPackageUpdated', this.onPackageUpdated);
        packageService.on('onPackageCancelled', this.onPackageCancelled);
        packageService.on('onPackageFailed', this.onPackageFailed);
        const manager = packageService.packageManager;
        const age = manager.getServerPackageListAge();
        // console.log('getServerPackageListAge', age);
        if (age <= 0 || age > 3600 * 24 * 30) {
            // this.loading = true;
        } else {
            this.updateDataItems();
        }
        const downloadStarted = manager.startPackageListDownload();
        const geoDownloadStarted = packageService.geoPackageManager.startPackageListDownload();
        const routingDownloadStarted = packageService.routingPackageManager.startPackageListDownload();
        console.log('startPackageListDownload', downloadStarted, geoDownloadStarted, routingDownloadStarted);
        // }, 800);
    }
    onLoaded() {
        if (isAndroid) {
            (this.$refs.listView.nativeView.nativeViewProtected as android.widget.ListView).setNestedScrollingEnabled(true);
        }
    }
    destroyed() {
        console.log('package view destroyed');
        const packageService = this.$packageService;
        packageService.off('onPackageListUpdated', this.onPackageListUpdated);
        packageService.off('onPackageListFailed', this.onPackageListFailed);
        packageService.off('onPackageStatusChanged', this.onPackageStatusChanged);
        packageService.off('onPackageUpdated', this.onPackageUpdated);
        packageService.off('onPackageCancelled', this.onPackageCancelled);
        packageService.off('onPackageFailed', this.onPackageFailed);
    }

    downloadComplete() {
        // updatePackages();
    }
    onPackageListUpdated(e) {
        console.log('received onPackageListUpdated', e.type);
        this.updateDataItems().then(() => {
            this.loading = false;
        });
    }
    onPackageListFailed(e) {
        console.log('received onPackageListFailed', e.type);
        alert('failed to get packages list');
    }

    onPackageCancelled(e) {
        console.log('received onPackageCancelled', e.type);
        this.onPackageUpdated(e);
    }
    onPackageFailed(e) {
        console.log('received onPackageFailed', e.type);
        this.onPackageUpdated(e);
    }

    onPackageStatusChanged(e) {
        const { id, status } = e.data;
        console.log('onPackageStatusChanged', e.type, id, status.getProgress(), this.dataItems.length);

        this.dataItems.some((d, index) => {
            if (d.id === id) {
                // console.log('updating item!', id, index);
                switch (e.type as PackageType) {
                    case 'geo':
                        d.geoStatus = status;
                        break;
                    case 'routing':
                        d.routingStatus = status;
                        break;
                    default:
                        d.status = status;
                }
                this.dataItems.setItem(index, d);
                // d.status = status;
                return true;
            }
            return false;
        });
    }
    onPackageUpdated(e) {
        const { id } = e.data;
        console.log('onPackageUpdated', id, e.type);
        this.dataItems.some((d, index) => {
            if (d.id === id) {
                // console.log('updating full item!', id, index);
                switch (e.type as PackageType) {
                    case 'geo':
                        d.geoInfo = this.$packageService.geoPackageManager.getServerPackage(id);
                        d.geoStatus = this.$packageService.geoPackageManager.getLocalPackageStatus(id, -1);
                        break;
                    case 'routing':
                        d.routingInfo = this.$packageService.routingPackageManager.getServerPackage(id);
                        d.routingStatus = this.$packageService.routingPackageManager.getLocalPackageStatus(id, -1);
                        break;
                    default:
                        d.info = this.$packageService.packageManager.getServerPackage(id);
                        d.status = this.$packageService.packageManager.getLocalPackageStatus(id, -1);
                }

                this.dataItems.setItem(index, d);
                return true;
            }
            return false;
        });
        // pkg = new Package(name, info, status);
        // runOnUiThread {
        //     contentView?.downloadComplete(id!!)
        // }
    }
    currentServerPackages: PackageInfoVector;
    updateDataItems() {
        const manager = this.$packageService.packageManager;
        const geomanager = this.$packageService.geoPackageManager;
        const routingmanager = this.$packageService.routingPackageManager;

        return Promise.resolve()
            .then(() => {
                if (this.currentServerPackages) {
                    return Promise.resolve(this.currentServerPackages);
                }
                return new Promise((resolve: (res: PackageInfoVector) => void) => manager.getServerPackages(resolve)).then(res => {
                    this.currentServerPackages = res;
                    return res;
                });
            })
            .then(packages => {
                // const packages = this.currentServerPackages;
                const list = [];
                const count = packages.size();
                // console.log('got results', packages, count);
                let name;
                for (let i = 0; i < count; i++) {
                    const info = packages.get(i);
                    name = info.getName();
                    // console.log('test', info.getPackageId(), name);

                    if (!name.startsWith(this.currentFolder)) {
                        continue; // belongs to a different folder, so ignore
                    }
                    // console.log('handling', name, this.currentFolder);
                    name = name.substring(this.currentFolder.length);
                    const index = name.indexOf('/');
                    let pkg;

                    if (index === -1) {
                        // This is actual package
                        const id = info.getPackageId();
                        const status = manager.getLocalPackageStatus(id, -1);
                        const geoStatus = geomanager.getLocalPackageStatus(id, -1);
                        const routingStatus = routingmanager.getLocalPackageStatus(id, -1);
                        const geoInfo = geomanager.getServerPackage(id);
                        const routingInfo = routingmanager.getServerPackage(id);
                        console.log('test', id, info.getName(), status, geoInfo, routingInfo);
                        pkg = new Package({ name, info, status, geoStatus, routingStatus, geoInfo, routingInfo });
                    } else {
                        // This is package group
                        name = name.substring(0, index);

                        // Try n' find an existing package from the list.
                        const existingPackages = list.filter(info => info.name === name) as any;

                        if (existingPackages.length === 0) {
                            // If there are none, add a package group if we don't have an existing list item
                            pkg = new Package({ name });
                        } else if (existingPackages.length === 1 && existingPackages[0].info != null) {
                            // Sometimes we need to add two labels with the same name.
                            // One a downloadable package and the other pointing to a list of said country's counties,
                            // such as with Spain, Germany, France, Great Britain

                            // If there is one existing package and its info isn't null,
                            // we will add a "parent" package containing subpackages (or package group)
                            pkg = new Package({ name });
                        } else {
                            // Shouldn't be added, as both cases are accounted for
                            continue;
                        }
                    }

                    list.push(pkg);
                }
                this.dataItems = new ObservableArray(list);
                this.loading = false;
            });
        // });
    }
    onBackButton() {
        const splitted = this.currentFolder.split('/');
        splitted.splice(-2, 1);
        this.currentFolder = splitted.join('/');
        this.updateDataItems();
    }
    handlePackageAction(type: PackageType, item: Package) {
        const action = item.getActionText(type);
        let manager: CartoPackageManager;
        if (type === 'geo') {
            manager = this.$packageService.geoPackageManager;
        } else if (type === 'routing') {
            manager = this.$packageService.routingPackageManager;
        } else {
            manager = this.$packageService.packageManager;
        }
        console.log(type, action);
        switch (action) {
            case Package.ACTION_GEO_DOWNLOAD:
            case Package.ACTION_ROUTING_DOWNLOAD:
            case Package.ACTION_DOWNLOAD:
                console.log('manager start', item.id);
                manager.startPackageDownload(item.id);
                // if (item.geoInfo) {
                //     console.log('geomanager start', item.id);
                //     geomanager.startPackageDownload(item.id);
                // }
                break;
            case Package.ACTION_PAUSE:
                manager.setPackagePriority(item.id, -1);
                // if (item.geoInfo) {
                //     geomanager.setPackagePriority(item.id, -1);
                // }
                break;
            case Package.ACTION_RESUME:
                manager.setPackagePriority(item.id, 0);
                // if (item.geoInfo) {
                //     geomanager.setPackagePriority(item.id, 0);
                // }
                break;
            case Package.ACTION_CANCEL:
                manager.cancelPackageTasks(item.id);
                // if (item.geoInfo) {
                //     geomanager.cancelPackageTasks(item.id);
                // }
                break;
            case Package.ACTION_REMOVE:
                manager.startPackageRemove(item.id);
                // if (item.geoInfo) {
                //     geomanager.startPackageRemove(item.id);
                // }
                break;
        }
    }
    onPackageClick(e: ItemEventData) {
        const item = this.dataItems.getItem(e.index);
        if (item.isGroup()) {
            this.currentFolder = this.currentFolder + item.name + '/';
            this.updateDataItems();
        } else {
            this.handlePackageAction('map', item);
        }
    }
}
