import { PackageAction, PackageInfo, PackageStatus } from '@nativescript-community/ui-carto/packagemanager';
import { PackageType } from './PackageService';

export class Package {
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
        if (!this.id) {
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
    static ACTION_DOWNLOAD = 'MAP';
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
