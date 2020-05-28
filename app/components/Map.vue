<template>
    <AlpiMapsPage actionBarHidden>
        <CartoMap ref="mapView" zoom="16" @mapReady="onMapReady" @mapMoved="onMapMove" @mapStable="onMapStable" @mapClicked="onMapClicked"/>
        <Search ref="searchView" class="searchView" :text="searchText" :projection="mapProjection" :opacity="scrollingWidgetsOpacity" :defaultElevation="topSheetTranslation === 0 ? 1 : 0" />
        <TopSheetHolder ref="topSheetHolder" @shouldClose="cancelDirections" @scroll="onTopSheetScroll" />

        <StackLayout orientation="vertical" verticalAlignment="middle" horizontalAlignment="right" isUserInteractionEnabled="false">
            <Label color="red" class="label-icon-btn" fontSize="12" text="mdi-crosshairs-gps" v-show="watchingLocation || queryingLocation" />
            <Label color="red" class="label-icon-btn" fontSize="12" text="mdi-sleep-off" v-show="keepAwake" />
        </StackLayout>

        <BottomSheetHolder id="itemBSHolder" ref="bottomSheetHolder" :marginBottom="navigationBarHeight" :peekerSteps="bottomSheetSteps" isPassThroughParentEnabled @close="unselectItem" @scroll="onBottomSheetScroll">
            <BottomSheet ref="bottomSheet" slot="bottomSheet" :item="selectedItem" :steps="bottomSheetSteps" />
        </BottomSheetHolder>

        <!-- <transition name="scale"> -->
        <MDButton
            :translateY="topSheetTranslation"
            transition="scale"
            v-show="currentMapRotation !== 0"
            @tap="resetBearing"
            class="small-floating-btn"
            text="mdi-navigation"
            :rotate="currentMapRotation"
            verticalAlignment="top"
            horizontalAlignment="right"
        />
        <!-- </transition> -->

        <MapScrollingWidgets ref="mapScrollingWidgets" :paddingTop="mapWidgetsTopPadding" :translateY="-bottomSheetTranslation" :opacity="scrollingWidgetsOpacity" />
        <Fab position="left" iconClass="mdi" icon="mdi-plus" iconOn="mdi-close" :translateY="-bottomSheetTranslation" :opacity="scrollingWidgetsOpacity" :backgroundColor="accentColor" color="white">
            <FabItem v-if="packageServiceEnabled" :title="$t('offline_packages') | titlecase" iconClass="mdi" icon="mdi-earth" @tap="downloadPackages" />
            <FabItem :title="$t('select_style') | titlecase" iconClass="mdi" icon="mdi-layers" @tap="selectStyle" />
            <FabItem :title="$t('select_language') | titlecase" iconClass="mdi" icon="mdi-translate" @tap="selectLanguage" />
            <FabItem :title="$t('location_info') | titlecase" iconClass="mdi" icon="mdi-speedometer" @tap="switchLocationInfo" />
            <FabItem :title="$t('share_screenshot') | titlecase" iconClass="mdi" icon="mdi-cellphone-screenshot" @tap="shareScreenshot" />
            <FabItem :title="$t('keep_awake') | titlecase" iconClass="mdi" :backgroundColor="keepAwake ? 'red' : 'green'" :icon="keepAwake ? 'mdi-sleep' : 'mdi-sleep-off'" @tap="switchKeepAwake" />
        </Fab>


        <BottomSheetHolder id="rightMenuBSHolder" ref="bottomSheetHolder2" :marginBottom="navigationBarHeight" :peekerSteps="[210]" isPassThroughParentEnabled>
            <MapRightMenu ref="mapMenu" slot="bottomSheet"/>
        </BottomSheetHolder>
        <!-- </GridLayout> -->
        <!-- <transition name="slide" duration="10000"> -->
        <AbsoluteLayout transition="slide" v-show="shouldShowNavigationBarOverlay" class="navigationBarOverlay" @loaded="onLoaded" />
        <!-- </transition> -->
    </AlpiMapsPage>
</template>
<script lang="ts" src="./Map.ts" />
