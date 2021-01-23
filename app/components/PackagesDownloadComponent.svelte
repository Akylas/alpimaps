<script lang="ts" context="module">
    import {
        PackageAction,
    } from '@nativescript-community/ui-carto/packagemanager';
    import type {
        CartoPackageManager,
        PackageInfo,
        PackageInfoVector,
        PackageStatus
    } from '@nativescript-community/ui-carto/packagemanager';
    import { ObservableArray } from '@nativescript/core/data/observable-array';
    import { onDestroy, onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { PackageType } from '~/services/PackageService';

    class Package {
        id: string;
        geoStatus: PackageStatus;
        routingStatus: PackageStatus;
        public name: string;
        public info?: PackageInfo;
        public status?: PackageStatus;
        public geoInfo?: PackageInfo;
        public routingInfo?: PackageInfo;

        constructor(options: {
            name: string;
            info?: PackageInfo;
            status?: PackageStatus;
            geoStatus?: PackageStatus;
            routingStatus?: PackageStatus;
            geoInfo?: PackageInfo;
            routingInfo?: PackageInfo;
        }) {
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
            return (
                Package.isDownloading(this.routingStatus) ||
                Package.isDownloading(this.geoStatus) ||
                Package.isDownloading(this.status)
            );
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
</script>

<script lang="ts">
    let dataItems: ObservableArray<Package> = new ObservableArray([] as any);
    let loading = true;
    let currentFolder = ''; // Current 'folder' of the package, for example "Asia/"
    let currentServerPackages: PackageInfoVector;

    onMount(() => {
        // this.dataItems = new ObservableArray([] as any);
        // console.log('package view mounted');
        const packageService = this.$packageService;
        packageService.on('onPackageListUpdated', this.onPackageListUpdated, this);
        packageService.on('onPackageListFailed', this.onPackageListFailed, this);
        packageService.on('onPackageStatusChanged', this.onPackageStatusChanged, this);
        packageService.on('onPackageUpdated', this.onPackageUpdated, this);
        packageService.on('onPackageCancelled', this.onPackageCancelled, this);
        packageService.on('onPackageFailed', this.onPackageFailed, this);
        setTimeout(() => {
            if (!packageService.updatePackagesLists()) {
                this.updateDataItems();
            }
        }, 800);
    });
    
    onDestroy(() => {
        const packageService = this.$packageService;
        if (packageService) {
            packageService.off('onPackageListUpdated', this.onPackageListUpdated, this);
            packageService.off('onPackageListFailed', this.onPackageListFailed, this);
            packageService.off('onPackageStatusChanged', this.onPackageStatusChanged, this);
            packageService.off('onPackageUpdated', this.onPackageUpdated, this);
            packageService.off('onPackageCancelled', this.onPackageCancelled, this);
            packageService.off('onPackageFailed', this.onPackageFailed, this);
        }
    });

    function downloadComplete() {
        // updatePackages();
    }
    function onPackageListUpdated(e) {
        this.updateDataItems().then(() => {
            this.loading = false;
        });
    }
    function onPackageListFailed(e) {
        alert('failed to get packages list');
    }

    function onPackageCancelled(e) {
        this.onPackageUpdated(e);
    }
    function onPackageFailed(e) {
        this.onPackageUpdated(e);
    }

    function onPackageStatusChanged(e) {
        const { id, status } = e.data;

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
    function onPackageUpdated(e) {
        const { id } = e.data;
        this.dataItems.some((d, index) => {
            if (d.id === id) {
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
    }
    function updateDataItems() {
        // console.log('updateDataItems');
        const manager = this.$packageService.packageManager;
        const geomanager = this.$packageService.geoPackageManager;
        const routingmanager = this.$packageService.routingPackageManager;
        return Promise.resolve()
            .then(() => {
                if (this.currentServerPackages) {
                    return Promise.resolve(this.currentServerPackages);
                }
                return new Promise((resolve: (res: PackageInfoVector) => void) => manager.getServerPackages(resolve)).then(
                    (res) => {
                        this.currentServerPackages = res;
                        return res;
                    }
                );
            })
            .then((packages) => {
                // const packages = this.currentServerPackages;
                const list = [];
                const count = packages.size();
                let name;
                for (let i = 0; i < count; i++) {
                    const info = packages.get(i);
                    name = info.getName();

                    if (!name.startsWith(this.currentFolder)) {
                        continue; // belongs to a different folder, so ignore
                    }
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
                        // const routingInfo = routingmanager.getServerPackage(id + '-routing');
                        const routingInfo = routingmanager.getServerPackage(id);
                        pkg = new Package({ name, info, status, geoStatus, routingStatus, geoInfo, routingInfo });
                    } else {
                        // This is package group
                        name = name.substring(0, index);

                        // Try n' find an existing package from the list.
                        const existingPackages = list.filter((info) => info.name === name) as any;

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
    function onBackButton() {
        const splitted = this.currentFolder.split('/');
        splitted.splice(-2, 1);
        this.currentFolder = splitted.join('/');
        this.updateDataItems();
    }
    function handlePackageAction(type: PackageType, item: Package) {
        const action = item.getActionText(type);
        let manager: CartoPackageManager;
        const suffix = '';
        if (type === 'geo') {
            manager = this.$packageService.geoPackageManager;
        } else if (type === 'routing') {
            // suffix =  '-routing';
            manager = this.$packageService.routingPackageManager;
        } else {
            manager = this.$packageService.packageManager;
        }
        switch (action) {
            case Package.ACTION_GEO_DOWNLOAD:
            case Package.ACTION_ROUTING_DOWNLOAD:
            case Package.ACTION_DOWNLOAD:
                manager.startPackageDownload(item.id + suffix);
                //     console.log('geomanager start', item.id);
                //     geomanager.startPackageDownload(item.id);
                // }
                break;
            case Package.ACTION_PAUSE:
                manager.setPackagePriority(item.id + suffix, -1);
                // if (item.geoInfo) {
                //     geomanager.setPackagePriority(item.id, -1);
                // }
                break;
            case Package.ACTION_RESUME:
                manager.setPackagePriority(item.id + suffix, 0);
                // if (item.geoInfo) {
                //     geomanager.setPackagePriority(item.id, 0);
                // }
                break;
            case Package.ACTION_CANCEL:
                manager.cancelPackageTasks(item.id + suffix);
                // if (item.geoInfo) {
                //     geomanager.cancelPackageTasks(item.id);
                // }
                break;
            case Package.ACTION_REMOVE:
                manager.startPackageRemove(item.id + suffix);
                // if (item.geoInfo) {
                //     geomanager.startPackageRemove(item.id);
                // }
                break;
        }
    }
    function onPackageClick(item: Package) {
        // const item = this.dataItems.getItem(e.index);
        if (item.isGroup()) {
            this.currentFolder = this.currentFolder + item.name + '/';
            this.updateDataItems();
        } else {
            this.handlePackageAction('map', item);
        }
    }
</script>

<gridlayout rows="50,*,auto,2*" columns="*,auto,*" height="300" >
    <stacklayout row="0" colSpan="3" orientation="horizontal">
        <button
            class="mdi"
            shape="round"
            width="48"
            height="48"
            variant="text"
            fontSize="20"
            text="mdi-arrow-left"
            visibility={currentFolder.length > 0 ? 'visible' : 'collapsed'}
            on:tap={onBackButton} />
        <label padding="10" color="white" fontSize="20" fontWeight="bold" text="Download Packages" />
    </stacklayout>
    <collectionview
        ref="listView"
        row="1"
        col="0"
        rowSpan="3"
        colSpan="3"
        rowHeight="49"
        items={dataItems}
        on:itemTap={onPackageClick}
        separatorColor="darkgray">
        <Template let:item>
            <!-- <StackLayout width="100%" height="100%" backgroundColor="red">
                        <Label text="item.name"  backgroundColor={gray}/>
                    </StackLayout> -->
            <gridlayout
                rows="*,auto,auto"
                columns="*,auto,auto,auto"
                padding="0 0 0 15"
                on:tap={onPackageClick(item)}
                rippleColor="white">
                <label
                    row="0"
                    text={item.name.toUpperCase()}
                    color="white"
                    fontSize="13"
                    fontWeight="bold"
                    verticalAlignment="center" />
                <label
                    row="1"
                    text="item.getStatusText()"
                    color="#D0D0D0"
                    fontSize="11"
                    :visibility={!item.isGroup() ? 'visible' : 'collapsed'}
                    verticalAlignment="center" />
                <label
                    col="2"
                    row="0"
                    rowSpan="3"
                    class="mdi"
                    color="navyblue"
                    text="mdi-chevron-right"
                    fontSize="16"
                    visibility={item.isGroup() ? 'visible' : 'collapsed'}
                    verticalAlignment="center" />
                <button
                    col="1"
                    row="0"
                    rowSpan="3"
                    variant="text"
                    margin="0"
                    padding="0"
                    text={item.getActionText('map')}
                    verticalAlignment="center"
                    horizontalAlignment="center"
                    :visibility={!item.isGroup() ? 'visible' : 'collapsed'}
                    fontSize="12"
                    on:tap={handlePackageAction('map', item)} />
                <button
                    col="2"
                    row="0"
                    rowSpan="3"
                    variant="text"
                    margin="0"
                    padding="0"
                    text={item.getGeoActionText()}
                    verticalAlignment="center"
                    :visibility={item.hasGeo() ? 'visible' : 'collapsed'}
                    fontSize="12"
                    on:tap={handlePackageAction('geo', item)} />
                <button
                    col="3"
                    row="0"
                    rowSpan="3"
                    variant="text"
                    margin="0"
                    padding="0"
                    text={item.getRoutingActionText()}
                    verticalAlignment="center"
                    :visibility={item.hasRouting() ? 'visible' : 'collapsed'}
                    fontSize="12"
                    on:tap={handlePackageAction('routing', item)} />
                <mdprogress
                    row="2"
                    col="0"
                    colSpan="4"
                    height="3"
                    value={item.getDownloadProgress()}
                    :visibility={!item.isGroup() ? 'visible' : 'collapsed'}
                    visibility={item.isDownloading() ? 'visible' : 'hidden'} />
            </gridlayout>
        </Template>
    </collectionview>
    <activityindicator visibility={loading ? 'visible' : 'collapsed'} row="2" col="1" busy />
</gridlayout>
