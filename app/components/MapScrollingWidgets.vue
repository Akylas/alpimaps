<template>
    <GridLayout rows="auto,*,auto" columns="70,*,70" isPassThroughParentEnabled>
        <Label borderRadius="6" v-show="showSuggestionPackage" col="1" row="2" backgroundColor="#55000000" verticalAlignment="bottom" verticalTextAlignment="middle" horizontalAlignment="center" textWrap marginBottom="30" fontSize="10" padding="4 2 4 4" @tap="downloadSuggestion" @longPress="customDownloadSuggestion" color="white" :html="`<big><big><font face="${mdiFontFamily}">mdi-download</font></big></big>${suggestionPackageName}`"/> 

            

        <!-- <Label v-if="currentLocation" col="0" row="0" colSpan="2" marginLeft="8" textWrap fontSize="12">
            <Span :text="$t('speed') + ': '" />
            <Span :text="currentLocation.speed | unit('km/h')" />
            <Span :text="'\n'" />
            <Span :text="$t('altitude') + ': '" />
            <Span :text="currentLocation.altitude | unit('m')" />
            <Span :text="'\n'" />
        </Label> -->
        <!-- <StackLayout class="cardView" orientation="horizontal" margin="2 0 2 4" col="1" row="2" v-show="showSuggestionPackage" opacity="0.7" borderRadius="6" horizontalAlignment="center" verticalAlignment="bottom" marginBottom="27" @tap="downloadSuggestion" @longPress="customDownloadSuggestion">
            <Label :text="suggestionPackageName" fontSize="10" verticalAlignment="center" horizontalAlignment="center" textWrap />
            <Label class="label-icon-btn" text="mdi-download" verticalAlignment="center" />
        </StackLayout> -->
        <StackLayout col="2" row="2" verticalAlignment="bottom" isPassThroughParentEnabled padding="2">
            <transition name="scale">
                <MDButton @tap="startDirections" row="0" rowSpan="2" col="2" class="floating-btn buttonthemed" text="mdi-directions" v-show="selectedItemHasPosition" />
            </transition>
            <GridLayout class="floating-btn" :class="locationButtonClass" @tap="askUserLocation" @longPress="onWatchLocation">
                <Label textAlignment="center" verticalTextAlignment="middle" class="mdi" :class="locationButtonLabelClass" text="mdi-crosshairs-gps" :color="watchingLocation? 'white': accentColor" />
            </GridLayout>
            <!-- <MDButton @tap="askUserLocation" @longPress="onWatchLocation"  :class="locationButtonClass" text="mdi-crosshairs-gps" /> -->
        </StackLayout>
        <ScaleView ref="scaleView" col="1" row="2" horizontalAlignment="right" verticalAlignment="bottom" marginBottom="8" />
        <Progress col="0" colSpan="3" row="2" :value="totalDownloadProgress" v-show="totalDownloadProgress > 0" verticalAlignment="bottom" />

    </GridLayout>
</template>
<script lang="ts" src="./MapScrollingWidgets.ts"/>
