<template>
    <GridLayout rows="auto,*,auto" columns="70,*,70" isPassThroughParentEnabled>
        <Label borderRadius="6" v-if="showSuggestionPackage" col="1" row="2" backgroundColor="#55000000" verticalAlignment="bottom" verticalTextAlignment="middle" horizontalAlignment="center" textWrap marginBottom="30" padding="4 2 4 4" @tap="downloadSuggestion" @longPress="customDownloadSuggestion" color="white">
            <Span class="mdi" fontSize="15" :text="'mdi-download' | fonticon" backgroundColor="transparent" />
            <Span :text="suggestionPackageName" fontSize="10" backgroundColor="transparent" />
        </Label>
        <transition name="scale">
            <MDButton transition="scale" v-show="currentMapRotation !== 0" col="2" @tap="resetBearing" class="small-floating-btn" :text="'mdi-navigation' | fonticon" :rotate="currentMapRotation" verticalAlignment="top" horizontalAligment="right" />
        </transition>

        <transition name="fade">
            <GridLayout  v-if="showLocationInfo" col="1" row="0" borderRadius="40" backgroundColor="#77000000" padding="6" columns="auto,*,auto" @swipe="showLocationInfo = false">
                <label width="60" height="60" borderRadius="30" borderWidth="4" :borderColor="accentColor" backgroundColor="#aaffffff" textWrap textAlignment="center" verticalTextAlignment="middle">
                    <Span :text="((currentLocation && currentLocation.speed !== undefined) ? currentLocation.speed.toFixed() : '-') + '\n'" fontSize="26" fontWeight="bold"  backgroundColor="transparent"/>
                    <Span text="km/h" fontSize="10" backgroundColor="transparent"/>
                </label>
                <label col="1" textWrap marginLeft="5" verticalAlignment="top" color="#fff">
                    <Span :text="$tu('altitude') + (listeningForBarometer ? `(${$t('barometer')})`:'') + '\n\n'" fontSize="11" :color="accentColor" />
                    <Span :text="currentAltitude" fontSize="20" fontWeight="bold" />
                    <Span text=" m" fontSize="12" />
                </label>
                <label col="1" v-if="listeningForBarometer && airportRefName" :text="airportRefName" verticalAlignment="bottom" horizontalAlignment="right" color="#fff" fontSize="9" />
                <StackLayout v-if="hasBarometer" col="2" verticalAlignment="center">
                    <MDButton variant="text" class="small-icon-btn" :text="'mdi-gauge' | fonticon" @tap="switchBarometer" color="white" />
                    <MDButton variant="text" class="small-icon-btn" v-if="listeningForBarometer" :text="'mdi-reflect-vertical' | fonticon" @tap="getNearestAirportPressure" color="white" />
                </StackLayout>
            </GridLayout>
        </transition>

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
            <Label class="label-icon-btn" :text="'mdi-download' | fonticon" verticalAlignment="center" />
        </StackLayout> -->
        <StackLayout orientation="vertical" col="2" row="2" verticalAlignment="bottom" isPassThroughParentEnabled padding="2">
            <transition name="scale">
                <MDButton  @tap="startDirections" row="0" rowSpan="2" col="2" class="floating-btn buttonthemed" :text="'mdi-directions' | fonticon" v-show="selectedItemHasPosition" />
            </transition>
            <GridLayout class="floating-btn" :class="locationButtonClass" @tap="askUserLocation" @longPress="onWatchLocation">
                <Label textAlignment="center" verticalTextAlignment="middle" class="mdi" :class="locationButtonLabelClass" :text="'mdi-crosshairs-gps' | fonticon" :color="watchingLocation? 'white': accentColor" />
            </GridLayout>
            <!-- <MDButton @tap="askUserLocation" @longPress="onWatchLocation"  :class="locationButtonClass" :text="'mdi-crosshairs-gps' | fonticon" /> -->
        </StackLayout>
        <ScaleView ref="scaleView" col="1" row="2" horizontalAlignment="right" verticalAlignment="bottom" marginBottom="8" />
        <Progress col="0" colSpan="3" row="2" :value="totalDownloadProgress" v-show="totalDownloadProgress > 0" verticalAlignment="bottom" />

    </GridLayout>
</template>
<script lang="ts" src="./MapScrollingWidgets.ts"/>
