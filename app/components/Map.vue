<template>
    <Page ref="page" class="page" @loaded="onLoaded">
        <MultiDrawer>
            <GridLayout slot="right" marginTop="20" rows="*,auto" @tap="noop">
                <ListView row="0" col="0" rowHeight="49" :items="customSources" separatorColor="gray" @tap="noop">
                    <v-template>
                        <GridLayout paddingLeft="15" paddingRight="5" rows="*,auto" height="70" @longPress="onSourceLongPress(item)">
                            <StackLayout col="0" verticalAlignment="center">
                                <Label :text="item.name.toUpperCase()" color="black" fontSize="13" fontWeight="bold" />
                                <MDSlider marginLeft="10" marginRight="10" ios:backgroundColor="#f27743" row="2" col="0" :value="Math.round(item.opacity * 100)" @valueChange="onLayerOpacityChanged(item, $event)" minValue="0" maxValue="100" verticalAlignment="center" @tap="noop" />
                            </StackLayout>
                        </GridLayout>
                    </v-template>
                </ListView>
                <StackLayout row="1">
                    <MDButton @tap="mapModules['customLayers'].addSource()" text="add source" />
                </StackLayout>
            </GridLayout>
            <AbsoluteLayout class="page">
                <CartoMap v-if="licenseRegistered" width="100%" height="100%" zoom="10" focusPos="45.2002,5.7222" @mapReady="onMapReady" @mapMoved="onMapMove" @mapStable="onMapStable" @mapClicked="onMapClicked" />
                <GridLayout ref="subHolder" rows="20,auto,*,auto" colums="*" width="100%" height="100%">
                    <BottomSheet ref="bottomSheet" row="3" />
                    <Search ref="searchView" row="1" :projection="mapProjection" />

                    <GridLayout rows="auto,*,auto" columns="auto,*,auto" row="2">
                        <label col="0" colSpan="3" row="2" :text="'zoom:' + currentMapZoom.toFixed(2)" verticalAlignment="bottom" />
                        <StackLayout orientation="vertical" col="0" row="2">
                            <!-- <MDButton @tap="openSearch" class="floating-btn" :text="'mdi-magnify' | fonticon" /> -->
                            <transition name="fade" duration="100">
                                <MDButton v-show="licenseRegistered" @tap="selectStyle" dock="left" class="floating-btn" :text="'mdi-layers' | fonticon" />
                            </transition>
                            <transition name="fade" duration="100">
                                <MDButton v-show="licenseRegistered" @tap="downloadPackages" dock="left" class="floating-btn" :text="'mdi-earth' | fonticon" />
                            </transition>
                        </StackLayout>
                        <StackLayout orientation="vertical" col="2" row="2" verticalAlignment="bottom">
                            <transition name="scale" :duration="200" mode="out-in">
                                <MDButton @tap="startDirections" dock="right" class="buttonthemed floating-btn" :text="'mdi-directions' | fonticon" v-show="!!this.selectedData" />
                            </transition>
                            <MDButton @tap="askUserLocation" @longPress="onWatchLocation" class="floating-btn" :text="'mdi-crosshairs-gps' | fonticon" />
                        </StackLayout>
                        <GridLayout row="1" col="0" colSpan="3" columns="'auto,*,auto">
                            <transition name="fade" duration="100">
                                <MDButton v-show="currentMapRotation !== 0" col="2" @tap="resetBearing" class="small-floating-btn" :text="'mdi-compass' | fonticon" :rotate="(-30 + currentMapRotation)" />
                            </transition>

                        </GridLayout>

                        <Progress col="0" colSpan="3" row="2" :value="totalDownloadProgress" v-show="totalDownloadProgress > 0" verticalAlignment="bottom" />
                    </GridLayout>
                </GridLayout>
            </AbsoluteLayout>
        </MultiDrawer>
    </Page>
</template>

<script lang="ts" src="./Map.ts">
</script>
