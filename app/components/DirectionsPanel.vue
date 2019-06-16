<template>
    <MDCardView :height="peekHeight" borderRadius="0" elevation="1" @pan="$emit('pan', $event)" :backgroundColor="themeColor">
        <GridLayout rows="auto,*,*" columns="auto,*,auto">
            <MDButton variant="flat" class="icon-btn-white" :text="'mdi-arrow-left' | fonticon" @tap="cancel" />
            <StackLayout col="1" orientation="horizontal" horizontalAlignment="center">
                <MDButton variant="flat" class="icon-btn-white" :text="'mdi-car' | fonticon" @tap="setProfile('car')" :color="profileColor('car')" />
                <MDButton variant="flat" class="icon-btn-white" :text="'mdi-walk' | fonticon" @tap="setProfile('pedestrian')" :color="profileColor('pedestrian')" />
                <MDButton variant="flat" class="icon-btn-white" :text="'mdi-bike' | fonticon" @tap="setProfile('bicycle')" :color="profileColor('bicycle')" />
                <MDButton variant="flat" class="icon-btn-white" :text="'mdi-auto-fix' | fonticon" @tap="setProfile('auto_shorter')" :color="profileColor('auto_shorter')" />
            </StackLayout>
            <MDButton col="2" variant="flat" class="icon-btn-text icon-btn-rounded " :text="'mdi-magnify' | fonticon" @tap="showRoute(false)" :isEnabled="!!startPos && !!stopPos" margin="4 10 4 10" :visibility="loading?'hidden':'visible'" />
            <MDActivityIndicator v-show="loading" col="2" busy="true" class="activity-indicator" width="44" height="44" color="white" />
            <MDCardView row="1" colSpan="3" borderRadius="4" height="44" margin="10">
                <GridLayout backgroundColor="white" columns=" *,auto,auto">
                    <MDTextField ref="startTF" col="0" marginLeft="15" row="0" hint="start" placeholder="start" returnKeyType="search" @textChange="onStartTextChange" width="100%" backgroundColor="transparent" floating="false" verticalAlignment="center" />
                    <MDActivityIndicator v-show="false" row="0" col="1" busy="true" class="activity-indicator" width="20" height="20" />
                    <MDButton variant="text" class="icon-btn" v-show="currentStartSearchText && currentStartSearchText.length > 0" row="0" col="2" :text="'mdi-close' | fonticon" @tap="clearStartSearch" color="gray"/>
                </GridLayout>
            </MDCardView>
            <MDCardView row="2" colSpan="3" borderRadius="4" height="44" margin="0 10 10 10">
                <GridLayout backgroundColor="white" columns=" *,auto,auto">
                    <MDTextField ref="stopTF" col="0" marginLeft="15" row="0" hint="stop" placeholder="stop" returnKeyType="search" @textChange="onStopTextChange" width="100%" backgroundColor="transparent" floating="false" verticalAlignment="center" />
                    <MDActivityIndicator v-show="false" row="0" col="1" busy="true" class="activity-indicator" width="20" height="20" />
                    <MDButton variant="text" class="icon-btn" v-show="currentStopSearchText && currentStopSearchText.length > 0" row="0" col="2" :text="'mdi-close' | fonticon" @tap="clearStopSearch"  color="gray"/>
                </GridLayout>
            </MDCardView>
        </GridLayout>
    </MDCardView>
</template>
<script lang="ts" src="./DirectionsPanel.ts"/>
