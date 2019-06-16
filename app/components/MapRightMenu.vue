<template>
    <GridLayout marginTop="20" rows="*,auto" @tap="noop">
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
            <MDButton class="buttonthemed" @tap="mapModule('customLayers').addSource()" text="add source" />
            <GridLayout columns="auto,*,auto">
                <Label class="icon-btn" :text="'mdi-domain' | fonticon" :color="show3DBuildings? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                <Label col="1" :text="'show 3D Buildings' | L" verticalAlignment="center" />
                <Switch col="2" ios:backgroundColor="#f27743" :checked="show3DBuildings" verticalAlignment="center" />
                <MDRipple colSpan="3" @tap="toggle3DBuildings" />
            </GridLayout>
            <GridLayout columns="auto,*,auto">
                <Label class="icon-btn" :text="'mdi-signal' | fonticon" :color="showContourLines? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                <Label col="1" :text="'show Elevation Contour Lines' | L" verticalAlignment="center" />
                <Switch col="2" ios:backgroundColor="#f27743" :checked="showContourLines" verticalAlignment="center" />
                <MDRipple colSpan="3" @tap="toggleContourLines" />
            </GridLayout>
            <GridLayout columns="auto,*,auto">
                <Label class="icon-btn" :text="'mdi-globe-model' | fonticon" :color="showGlobe? themeColor : 'gray'" verticalAlignment="center" padding="5" />
                <Label col="1" :text="'Globe Mode' | L" verticalAlignment="center" />
                <Switch col="2" ios:backgroundColor="#f27743" :checked="showGlobe" verticalAlignment="center" />
                <MDRipple colSpan="3" @tap="toggleGlobe" />
            </GridLayout>
        </StackLayout>
    </GridLayout>

</template>
<script lang="ts" src="./MapRightMenu.ts"/>
