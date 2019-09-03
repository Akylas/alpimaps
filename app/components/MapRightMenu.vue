<template>
    <GridLayout android:marginTop="24" rows="*,auto" @tap="noop">
        <CollectionView row="0" rowHeight="49" :items="customSources" @tap="noop">
            <v-template>
                <GridLayout paddingLeft="15" paddingRight="5" rows="*,auto" columns="*,auto" @longPress="onSourceLongPress(item)">
                    <Label row="0" :text="item.name.toUpperCase()" :color="item.layer.opacity === 0 ? 'grey' : 'white'" fontSize="13" fontWeight="bold" verticalAlignment="bottom" />
                    <MDSlider row="1" marginLeft="10" marginRight="10" :value="Math.round(item.layer.opacity * 100)" @valueChange="onLayerOpacityChanged(item, $event)" minValue="0" maxValue="100" verticalAlignment="center" @tap="noop" />
                    <MDButton col="1" rowSpan="2" color="white" rippleColor="white" variant="flat" class="icon-btn" :text="'mdi-dots-vertical' | fonticon" @tap="onSourceLongPress(item)" />
                </GridLayout>
            </v-template>
        </CollectionView>
        <ScrollView row="1">
            <StackLayout>
                <MDButton class="buttonthemed" @tap="addSource" text="add source" />
                <MDButton class="buttonthemed" @tap="clearCache" text="clear cache" />
                <GridLayout columns="auto,*,auto" :rippleColor="themeColor" @tap="toggle3DBuildings">
                    <Label class="label-icon-btn" :text="'mdi-domain' | fonticon" :color="show3DBuildings? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                    <Label col="1" :text="$t('show 3D Buildings')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <Switch col="2" ios:backgroundColor="#f27743" :checked="show3DBuildings" @checkedChange="show3DBuildings = $event.value" verticalAlignment="center" />
                    <!-- <MDRipple colSpan="3" @tap="toggle3DBuildings" /> -->
                </GridLayout>
                <GridLayout columns="auto,*,auto" @tap="toggleContourLines" :rippleColor="themeColor">
                    <Label class="label-icon-btn" :text="'mdi-signal' | fonticon" :color="showContourLines? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                    <Label col="1" :text="$tc('show Elevation Contour Lines')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <Switch col="2" ios:backgroundColor="#f27743" :checked="showContourLines" @checkedChange="showContourLines = $event.value" verticalAlignment="center" />
                    <!-- <MDRipple colSpan="3" /> -->
                </GridLayout>
                <GridLayout columns="auto,*,auto" :rippleColor="themeColor" @tap="toggleGlobe">
                    <Label class="label-icon-btn" :text="'mdi-globe-model' | fonticon" :color="showGlobe? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                    <Label col="1" :text="$tc('Globe Mode')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <Switch col="2" ios:backgroundColor="#f27743" :checked="showGlobe" @checkedChange="showGlobe = $event.value" verticalAlignment="center" />
                    <!-- <MDRipple colSpan="3" @tap="toƒisNaggleGlobe" /> -->
                </GridLayout>
                <GridLayout columns="auto,*,auto" :rippleColor="themeColor" @tap="toggleGlobe">
                    <!-- <Label class="label-icon-btn" :text="'mdi-globe-model' | fonticon" :color="showGlobe? themeColor : 'gray'" verticalAlignment="center" padding="5" /> -->
                    <Label col="1" :text="$tc('preloading')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <Switch col="2" ios:backgroundColor="#f27743" :checked="preloading" @checkedChange="preloading = $event.value" verticalAlignment="center" />
                    <!-- <MDRipple colSpan="3" @tap="toƒisNaggleGlobe" /> -->
                </GridLayout>
                <GridLayout columns="auto,*,auto">
                    <Label class="label-icon-btn" :text="'mdi-magnifier-plus-outline' | fonticon" :color="themeColor" verticalAlignment="center" padding="5" />
                    <Label col="1" :text="$tc('Zoom Biais')" verticalAlignment="center" textWrap fontSize="13" color="white" />
                    <MDTextField col="2" padding="8" variant="filled" placeholder="biais" :text="zoomBiais" @returnPress="onZoomBiaisChanged" width="100" backgroundColor="transparent" floating="false" textAlignment="right" verticalAlignment="center" keyboardType="number" margin="4" />
                </GridLayout>
            </StackLayout>
        </ScrollView>

        <transition name="fade" duration="200">
            <GridLayout rowSpan="2" v-if="currentLegend" rows="auto,*" columns="auto,*" backgroundColor="white">
                <WebView rowSpan="2" colSpan="2" v-if="currentLegend" :src="currentLegend" />
                <!-- <NSImg rowSpan="2" colSpan="2" v-if="currentLegend && !currentLegend.endsWith('.html')" :src="currentLegend" /> -->
                <MDButton variant="flat" class="icon-btn" :text="'mdi-arrow-left' | fonticon" @tap="currentLegend = null" />
            </GridLayout>
        </transition>
    </GridLayout>

</template>
<script lang="ts" src="./MapRightMenu.ts"/>
