<template>
    <Page actionBarHidden="true" @loaded="onLoaded">
        <!-- <CanvasLabel>
            <CSpan color="black" :text="$t('loading_map')" verticalTextAlignment="middle" textAlignment="center" />
        </CanvasLabel> -->
        <Drawer ref="drawer">
            <GridLayout ~leftDrawer rows="auto, *, auto" height="100%" backgroundColor="#1E1E24" width="70%">
                <StackLayout row="2" width="100%" padding="10">
                    <StackLayout class="menuButtons" orientation="horizontal">
                        <MDButton col="0" variant="text" text="mdi-email" @tap="onTap('sendFeedback')" />
                        <MDButton col="1" variant="text" text="mdi-bug" @tap="onTap('sendBugReport')" v-if="isSentryEnabled" />
                    </StackLayout>
                    <StackLayout class="menuInfos">
                        <Label :text="'App version: ' + (appVersion || '')" />
                    </StackLayout>
                </StackLayout>
            </GridLayout>
            <MapRightMenu ~rightDrawer ref="rightMenu" />

            <BottomSheet
                ~mainContent
                v-model="bottomSheetStepIndex"
                @stepIndexChange="onStepIndexChanged"
                :steps="null"
                :translationFunction="bottomSheetTranslationFunction"
                :android:marginBottom="navigationBarHeight"
            >
                <CartoMap
                    ref="mapView"
                    zoom="16"
                    @mapReady="onMapReady"
                    @mapMoved="onMapMove"
                    @mapStable="onMapStable"
                    @mapClicked="onMapClicked"
                />

                <Search
                    ref="searchView"
                    verticalAlignment="top"
                    :text="searchText"
                    :projection="mapProjection"
                    :defaultElevation="topSheetTranslation === 0 ? 1 : 0"
                    :isUserInteractionEnabled="scrollingWidgetsOpacity > 0.3"
                />
                <LocationInfoPanel
                    horizontalAlignment="left"
                    verticalAlignment="top"
                    marginLeeft="20"
                    marginTop="90"
                    ref="locationInfo"
                    :isUserInteractionEnabled="scrollingWidgetsOpacity > 0.3"
                />
                <TopSheetHolder ref="topSheetHolder" @shouldClose="cancelDirections" @scroll="onTopSheetScroll" />

                <CanvasLabel
                    orientation="vertical"
                    verticalAlignment="middle"
                    horizontalAlignment="right"
                    isUserInteractionEnabled="false"
                    color="red"
                    class="label-icon-btn"
                    fontSize="12"
                    width="20"
                    height="30"
                >
                    <CSpan
                        text="mdi-crosshairs-gps"
                        v-show="watchingLocation || queryingLocation"
                        textAlignment="left"
                        verticalTextAlignement="top"
                    />
                    <CSpan text="mdi-sleep-off" v-show="keepAwake" textAlignment="left" verticalTextAlignement="bottom" />
                </CanvasLabel>

                <!-- <BottomSheetHolder
                id="itemBSHolder"
                ref="bottomSheetHolder"
                :marginBottom="navigationBarHeight"
                isPassThroughParentEnabled
                @close="unselectItem"
                @scroll="onBottomSheetScroll"
            > -->
                <BottomSheetInner ref="bottomSheet" ~bottomSheet :updating="itemLoading" />
                <!-- </BottomSheetHolder> -->

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

                <MapScrollingWidgets
                    ref="mapScrollingWidgets"
                    :paddingTop="mapWidgetsTopPadding"
                    :translateY="-bottomSheetTranslation"
                    :opacity="scrollingWidgetsOpacity"
                    :userInteractionEnabled="scrollingWidgetsOpacity > 0.3"
                />
                <MDSpeedDial
                    position="left"
                    ref="speeddial"
                    text="mdi-plus"
                    iconOn="mdi-close"
                    :translateY="-bottomSheetTranslation"
                    :isUserInteractionEnabled="scrollingWidgetsOpacity > 0.3"
                >
                    <MDSpeedDialItem
                        v-if="packageServiceEnabled"
                        :title="$t('offline_packages') | titlecase"
                        text="mdi-earth"
                        @tap="downloadPackages"
                    />
                    <MDSpeedDialItem :title="$t('select_style') | titlecase" text="mdi-layers" @tap="selectStyle" />
                    <MDSpeedDialItem :title="$t('select_language') | titlecase" text="mdi-translate" @tap="selectLanguage" />
                    <MDSpeedDialItem :title="$t('location_info') | titlecase" text="mdi-speedometer" @tap="switchLocationInfo" />
                    <MDSpeedDialItem
                        :title="$t('share_screenshot') | titlecase"
                        text="mdi-cellphone-screenshot"
                        @tap="shareScreenshot"
                    />
                    <MDSpeedDialItem
                        :title="$t('keep_awake') | titlecase"
                        :backgroundColor="keepAwake ? 'red' : 'green'"
                        :text="keepAwake ? 'mdi-sleep' : 'mdi-sleep-off'"
                        @tap="switchKeepAwake"
                    />
                </MDSpeedDial>

                <!-- <BottomSheetHolder
            id="rightMenuBSHolder"
            ref="bottomSheetHolder2"
            :marginBottom="navigationBarHeight"
            isPassThroughParentEnabled
        > -->
                <!-- </BottomSheetHolder> -->
                <AbsoluteLayout
                    transition="slide"
                    v-show="shouldShowNavigationBarOverlay"
                    class="navigationBarOverlay"
                    @loaded="onLoaded"
                />
            </BottomSheet>
        </Drawer>
    </Page>
</template>
<script lang="ts" src="./Map.ts" />
