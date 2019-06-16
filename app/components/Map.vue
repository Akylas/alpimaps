<template>

    <GridLayout rows="auto,*" backgroundColor="white" columns="*" @layoutChanged="onLayoutChange">
        <CartoMap rowSpan="2" ref="mapView" v-if="licenseRegistered" width="100%" height="100%" zoom="16" @mapReady="onMapReady" @mapMoved="onMapMove" @mapStable="onMapStable" @mapClicked="onMapClicked" />
        <transition name="fade" duration="200">
            <Search ref="searchView" row="0" :projection="mapProjection" />
        </transition>

        <TopSheetHolder row="0" rowSpan="2" ref="topSheetHolder" @shouldClose="cancelDirections">
            <MapWidgets ref="mapWidgets" v-show="licenseRegistered && !searchResultsVisible" />
        </TopSheetHolder>
        <BottomSheetHolder rowSpan="2" ref="bottomSheetHolder" width="100%" height="100%" :peekerSteps="bottomSheetSteps" isPassThroughParentEnabled="true" @close="unselectItem" @scroll="onBottomSheetScroll">
            <GridLayout :paddingBottom="bottomSheetTranslation" :opacity="scrollingWidgetsOpacity">
                <MapScrollingWidgets ref="mapScrollingWidgets" v-show="licenseRegistered" />
                <transition name="fade" duration="100">
                    <Fab position="left" rowSpan="2" iconClass="mdi" :icon="'mdi-plus' | fonticon" :iconOn="'mdi-close' | fonticon">
                        <FabItem :title="$t('select_language') | titlecase" iconClass="mdi" :icon="'mdi-layers' | fonticon" @tap="selectLanguage" />
                        <FabItem :title="$t('select_style') | titlecase" iconClass="mdi" :icon="'mdi-layers' | fonticon" @tap="selectStyle" />
                        <FabItem :title="$t('offline_packages') | titlecase" iconClass="mdi" :icon="'mdi-earth' | fonticon" @tap="downloadPackages" />
                    </Fab>
                </transition>
            </GridLayout>
            <BottomSheet slot="bottomSheet" :item="selectedItem" :steps="bottomSheetSteps" />
        </BottomSheetHolder>
    </GridLayout>
</template>
<script lang="ts" src="./Map.ts"/>
