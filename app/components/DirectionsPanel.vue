<template>
    <GridLayout  android:paddingTop="24" elevation="1" :height="peekHeight" @pan="$emit('pan', $event)" :backgroundColor="themeColor" rows="auto,*,*" columns="auto,*,auto">
        <MDButton variant="flat" class="icon-btn-white" :text="'mdi-arrow-left' | fonticon" @tap="cancel" />
        <StackLayout col="1" orientation="horizontal" horizontalAlignment="center">
            <MDButton variant="flat" class="icon-btn-white" :text="'mdi-car' | fonticon" @tap="setProfile('car')" :color="profileColor('car')" />
            <MDButton variant="flat" class="icon-btn-white" :text="'mdi-walk' | fonticon" @tap="setProfile('pedestrian')" :color="profileColor('pedestrian')" />
            <MDButton variant="flat" class="icon-btn-white" :text="'mdi-bike' | fonticon" @tap="setProfile('bicycle')" :color="profileColor('bicycle')" />
            <MDButton variant="flat" class="icon-btn-white" :text="'mdi-auto-fix' | fonticon" @tap="setProfile('auto_shorter')" :color="profileColor('auto_shorter')" />
        </StackLayout>
        <MDButton col="2" variant="flat" class="icon-btn-text icon-btn-rounded " :text="'mdi-magnify' | fonticon" @tap="showRoute(false)" @LongPress="showRoute(true)" :isEnabled="waypoints.length > 0" margin="4 10 4 10" :visibility="loading?'hidden':'visible'" />
        <MDActivityIndicator v-show="loading" col="2" busy class="activity-indicator" width="44" height="44" color="white" />
        <GridLayout row="1" colSpan="3" class="cardView" columns=" *,auto,auto" height="44" margin="10">
            <MDTextField ref="startTF" col="0" marginLeft="15" row="0" hint="start" placeholder="start" returnKeyType="search" @textChange="onStartTextChange" width="100%" variant="none" backgroundColor="transparent" floating="false" verticalAlignment="center" />
            <MDActivityIndicator v-show="false" row="0" col="1" busy class="activity-indicator" width="20" height="20" />
            <MDButton variant="text" class="icon-btn" v-show="currentStartSearchText && currentStartSearchText.length > 0" row="0" col="2" :text="'mdi-close' | fonticon" @tap="clearStartSearch" color="gray" />
        </GridLayout>
        <GridLayout row="2" colSpan="3" class="cardView" columns=" *,auto,auto" height="44" margin="0 10 10 10">
            <MDTextField ref="stopTF" variant="none" col="0" marginLeft="15" row="0" hint="stop" placeholder="stop" returnKeyType="search" @textChange="onStopTextChange" width="100%" backgroundColor="transparent" floating="false" verticalAlignment="center" />
            <MDActivityIndicator v-show="false" row="0" col="1" busy class="activity-indicator" width="20" height="20" />
            <MDButton variant="text" class="icon-btn" v-show="currentStopSearchText && currentStopSearchText.length > 0" row="0" col="2" :text="'mdi-close' | fonticon" @tap="clearStopSearch" color="gray" />
        </GridLayout>
    </GridLayout>
</template>
<script lang="ts" src="./DirectionsPanel.ts"/>
