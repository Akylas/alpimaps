<template>
    <AlpiMapsPage actionBarHidden>
        <!-- <GridLayout rows="auto,*" backgroundColor="white" columns="*" @layoutChanged="onLayoutChange"> -->
        <CartoMap ref="mapView" zoom="16" @mapReady="onMapReady" @mapMoved="onMapMove" @mapStable="onMapStable" @mapClicked="onMapClicked" @layoutChanged="onLayoutChange" />
        <!-- <GridLayout ref="overMapWidgets" class="overMapWidgets" @loaded="onLoaded"> -->
        <Search ref="searchView" class="searchView" :text="searchText" :projection="mapProjection" :opacity="scrollingWidgetsOpacity" :defaultElevation="topSheetTranslation === 0?1:0" />
        <!-- </transition> -->

        <TopSheetHolder ref="topSheetHolder" @shouldClose="cancelDirections" @scroll="onTopSheetScroll">
        </TopSheetHolder>

         <StackLayout orientation="vertical" verticalAlignment="middle" horizontalAlignment="right" isUserInteractionEnabled="false">
            <Label color="red" class="label-icon-btn" fontSize="12" :text="'mdi-crosshairs-gps' | fonticon" v-show="watchingLocation || queryingLocation"/> 
            <Label color="red" class="label-icon-btn" fontSize="12" :text="'mdi-sleep-off' | fonticon" v-show="keepAwake"/> 
        </StackLayout>

        <BottomSheetHolder ref="bottomSheetHolder"  :marginBottom="navigationBarHeight" :peekerSteps="bottomSheetSteps" isPassThroughParentEnabled @close="unselectItem" @scroll="onBottomSheetScroll">
            <BottomSheet ref="bottomSheet" slot="bottomSheet" :item="selectedItem" :steps="bottomSheetSteps" />
        </BottomSheetHolder>
        <MapScrollingWidgets ref="mapScrollingWidgets" :paddingTop="mapWidgetsTopPadding" :paddingBottom="bottomSheetTranslation" :opacity="scrollingWidgetsOpacity" />
        <Fab position="left" rowSpan="2" iconClass="mdi" :icon="'mdi-plus' | fonticon" :iconOn="'mdi-close' | fonticon" :paddingBottom="bottomSheetTranslation" :opacity="scrollingWidgetsOpacity" :backgroundColor="accentColor" color="white">
            <FabItem :title="$t('keep_awake') | titlecase" iconClass="mdi" :backgroundColor="keepAwake ? 'red' : 'green'" :icon="(keepAwake ? 'mdi-sleep' : 'mdi-sleep-off') | fonticon" @tap="switchKeepAwake" />
            <FabItem :title="$t('share_screenshot') | titlecase" iconClass="mdi" :icon="'mdi-cellphone-screenshot' | fonticon" @tap="shareScreenshot" />
            <FabItem :title="$t('location_info') | titlecase" iconClass="mdi" :icon=" 'mdi-speedometer' | fonticon" @tap="switchLocationInfo" />
            <FabItem :title="$t('select_language') | titlecase" iconClass="mdi" :icon="'mdi-translate' | fonticon" @tap="selectLanguage" />
            <FabItem :title="$t('select_style') | titlecase" iconClass="mdi" :icon="'mdi-layers' | fonticon" @tap="selectStyle" />
            <FabItem :title="$t('offline_packages') | titlecase" iconClass="mdi" :icon="'mdi-earth' | fonticon" @tap="downloadPackages" />
        </Fab>
        <!-- </GridLayout> -->
        <!-- <transition name="slide" duration="10000"> -->
            <AbsoluteLayout transition="slide" v-visible="shouldShowNavigationBarOverlay" class="navigationBarOverlay" @loaded="onLoaded" />
        <!-- </transition> -->
    </AlpiMapsPage>
</template>
<script lang="ts" src="./Map.ts"/>
