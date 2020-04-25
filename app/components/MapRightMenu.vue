<template>
    <GridLayout columns="*,auto" @tap="noop">
        <CollectionView col="0" rowHeight="49" :items="customSources" @tap="noop">
            <v-template>
                <GridLayout paddingLeft="15" paddingRight="5" rows="*,auto" columns="*,auto" @longPress="onSourceLongPress(item)">
                    <Label row="0" :text="item.name.toUpperCase()" :color="item.layer.opacity === 0 ? 'grey' : 'white'" fontSize="13" fontWeight="bold" verticalAlignment="bottom" />
                    <MDSlider
                        row="1"
                        marginLeft="10"
                        marginRight="10"
                        :value="Math.round(item.layer.opacity * 100)"
                        @valueChange="onLayerOpacityChanged(item, $event)"
                        minValue="0"
                        maxValue="100"
                        verticalAlignment="center"
                        @tap="noop"
                    />
                    <MDButton col="1" rowSpan="2" color="white" rippleColor="white" variant="flat" class="icon-btn" text="mdi-dots-vertical" @tap="onSourceLongPress(item)" />
                </GridLayout>
            </v-template>
        </CollectionView>
        <!-- <ScrollView> -->
            <StackLayout col="1" borderLeftColor="rgba(255,255,255,0.4)" borderLeftWidth="1">
            <MDButton variant="flat" class="icon-btn" text="mdi-plus" @tap="addSource"/>
            <MDButton variant="flat" class="icon-btn" text="mdi-layers-off" @tap="clearCache"/>
                <!-- <MDButton class="buttonthemed" @tap="addSource" :text="$t('add_source')" /> -->
                <!-- <MDButton class="buttonthemed" @tap="clearCache" :text="$t('clear_cache')" /> -->
                <!-- <MDButton class="buttonthemed" @tap="selectLocalMbtilesFolder" :text="$t('select_local_folder')" /> -->
            <MDButton variant="flat" class="icon-btn" text="mdi-domain"  :color="mshow3DBuildings ? themeColor : 'gray'" @tap="toggle3DBuildings"/>
                <!-- <GridLayout columns="auto,*,auto" :rippleColor="themeColor" @tap="toggle3DBuildings">
                    <Label class="label-icon-btn" text="mdi-domain" :color="show3DBuildings ? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                    <Label col="1" :text="$t('show 3D Buildings')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <Switch col="2" ios:backgroundColor="#f27743" :checked="show3DBuildings" @checkedChange="show3DBuildings = $event.value" verticalAlignment="center" />
                </GridLayout> -->
            <MDButton variant="flat" class="icon-btn" text="mdi-signal"  :color="mshowContourLines ? themeColor : 'gray'" @tap="toggleContourLines"/>
                <!-- <GridLayout columns="auto,*,auto" @tap="toggleContourLines" :rippleColor="themeColor">
                    <Label class="label-icon-btn" text="mdi-signal" :color="showContourLines ? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                    <Label col="1" :text="$tc('show Elevation Contour Lines')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <Switch col="2" ios:backgroundColor="#f27743" :checked="showContourLines" @checkedChange="showContourLines = $event.value" verticalAlignment="center" />
                </GridLayout> -->
            <MDButton variant="flat" class="icon-btn" text="mdi-globe-model"  :color="mshowGlobe ? themeColor : 'gray'" @tap="toggleGlobe"/>

                <!-- <GridLayout columns="auto,*,auto" :rippleColor="themeColor" @tap="toggleGlobe">
                    <Label class="label-icon-btn" text="mdi-globe-model" :color="showGlobe ? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                    <Label col="1" :text="$tc('Globe Mode')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <Switch col="2" ios:backgroundColor="#f27743" :checked="showGlobe" @checkedChange="showGlobe = $event.value" verticalAlignment="center" />
                </GridLayout> -->

            <MDButton variant="flat" class="icon-btn" text="mdi-map-clock"  v-show="packageServiceEnabled" :color="mpreloading ? themeColor : 'gray'" @tap="togglePreloading"/>
                <!-- <GridLayout v-show="packageServiceEnabled" columns="auto,*,auto" :rippleColor="themeColor" @tap="toggleGlobe">
                    <Label class="label-icon-btn" text="mdi-map-clock" :color="preloading ? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                    <Label col="1" :text="$tc('preloading')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <Switch col="2" ios:backgroundColor="#f27743" :checked="preloading" @checkedChange="preloading = $event.value" verticalAlignment="center" />
                </GridLayout> -->
                <!-- <GridLayout columns="auto,*,auto">
                    <Label class="label-icon-btn" text="mdi-magnify" :color="themeColor" verticalAlignment="center" padding="5" />
                    <Label col="1" :text="$tc('Zoom Biais')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <MDTextField
                        col="2"
                        padding="8"
                        variant="filled"
                        placeholder="biais"
                        :text="zoomBiais"
                        @returnPress="onZoomBiaisChanged"
                        width="100"
                        backgroundColor="transparent"
                        floating="false"
                        textAlignment="right"
                        verticalAlignment="center"
                        keyboardType="number"
                        margin="4"
                    />
                </GridLayout> -->
            </StackLayout>
        <!-- </ScrollView> -->

        <!-- <transition name="fade" duration="200">
            <GridLayout v-show="currentLegend" rows="auto,*" columns="auto,*" backgroundColor="white">
                <WebView rowSpan="2" colSpan="2" v-if="currentLegend" :src="currentLegend" @scroll="onListViewScroll"  />
                <MDButton variant="flat" class="icon-btn" text="mdi-arrow-left" @tap="currentLegend = null" />
            </GridLayout>
        </transition> -->
    </GridLayout>
</template>
<script lang="ts" src="./MapRightMenu.ts" />
