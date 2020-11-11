<template>
    <GridLayout rows="auto,*,auto" columns="70,*,70" isPassThroughParentEnabled>
        <Label borderRadius="6" v-show="showSuggestionPackage" col="1" row="2" backgroundColor="#55000000"
        verticalAlignment="bottom" verticalTextAlignment="middle" horizontalAlignment="center" textWrap marginBottom="30"
        fontSize="10" padding="4 2 4 4" @tap="downloadSuggestion" @longPress="customDownloadSuggestion" color="white" :html="`<big
            ><big><font face="${mdiFontFamily}">mdi-download</font></big></big
        >${suggestionPackageName}`"/>
        <StackLayout col="2" row="2" verticalAlignment="bottom" isPassThroughParentEnabled padding="2">
            <transition name="scale">
                <MDButton
                    @tap="startDirections"
                    row="0"
                    rowSpan="2"
                    col="2"
                    class="floating-btn"
                    text="mdi-directions"
                    v-show="selectedItemHasPosition"
                    :isUserInteractionEnabled="userInteractionEnabled"
                />
            </transition>
            <GridLayout
                class="floating-btn"
                :class="locationButtonClass"
                @tap="askUserLocation"
                @longPress="onWatchLocation"
                :isUserInteractionEnabled="userInteractionEnabled"
            >
                <Label
                    textAlignment="center"
                    verticalTextAlignment="middle"
                    class="mdi"
                    :class="locationButtonLabelClass"
                    text="mdi-crosshairs-gps"
                    :color="watchingLocation ? 'white' : accentColor"
                    isUserInteractionEnabled="false"
                />
            </GridLayout>
        </StackLayout>
        <ScaleView ref="scaleView" col="1" row="2" horizontalAlignment="right" verticalAlignment="bottom" marginBottom="8" />
        <MDProgress
            col="0"
            colSpan="3"
            row="2"
            :value="totalDownloadProgress"
            v-show="totalDownloadProgress > 0"
            verticalAlignment="bottom"
        />
    </GridLayout>
</template>
<script lang="ts" src="./MapScrollingWidgets.ts" />
