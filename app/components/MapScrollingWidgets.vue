<template>
    <GridLayout rows="auto,*,auto" columns="70,*,70" width="100%" height="100%" isPassThroughParentEnabled="true">
        <MDCardView col="1" row="2" v-show="showSuggestionPackage" opacity="0.7" borderRadius="6" horizontalAlignment="center" verticalAlignment="bottom" marginBottom="27"  @tap="downloadSuggestion"  @longPress="customDownloadSuggestion">
            <StackLayout orientation="horizontal" margin="2 0 2 4">
                <Label :text="suggestionPackageName" fontSize="10" verticalAlignment="center" horizontalAlignment="center" textWrap="true" />
                <Label class="label-icon-btn" :text="'mdi-download' | fonticon" verticalAlignment="center" />
            </StackLayout>
        </MDCardView>
        <StackLayout orientation="vertical" col="2" row="2" verticalAlignment="bottom" isPassThroughParentEnabled="true" padding="2">
            <transition name="scale" duration="200" mode="out-in">
                <MDButton @tap="startDirections" row="0" rowSpan="2" col="2" class="buttonthemed floating-btn" :text="'mdi-directions' | fonticon" v-show="selectedItemHasPosition" />
            </transition>
            <MDButton @tap="askUserLocation" @longPress="onWatchLocation" class="floating-btn buttontext" :text="'mdi-crosshairs-gps' | fonticon" />

        </StackLayout>
        <ScaleView ref="scaleView" col="1" row="2" horizontalAlignment="right" verticalAlignment="bottom" margin="0 0 12 0" />
        <Progress col="0" colSpan="3" row="2" :value="totalDownloadProgress" v-show="totalDownloadProgress > 0" verticalAlignment="bottom" />

    </GridLayout>
</template>
<script lang="ts" src="./MapScrollingWidgets.ts"/>
