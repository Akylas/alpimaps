<template>
    <CanvasLabel fontSize="16" color="white" padding="10">
        <CSpan horizontalAlignment="left" verticalAlignment="top" :text="routeInstruction && routeInstruction.instruction" fontSize="15"/>
        <CSpan horizontalAlignment="left" verticalAlignment="top" color="#01B719" fontWeight="bold" :text="routeDuration" :fontSize="routeInstruction?10:16" :paddingTop="routeInstruction?18:0"/>
        <CGroup verticalAlignment="bottom" textAlignment="left">
            <CSpan color="gray" :fontFamily="mdiFontFamily" text="mdi-map-marker-distance" />
            <CSpan :text="' ' + routeDistance" fontSize="14" />
        </CGroup>
        <CGroup verticalAlignment="bottom" textAlignment="center" v-if="hasProfile">
            <CSpan color="gray" :fontFamily="mdiFontFamily" text="mdi-elevation-rise" />
            <CSpan :text="' ' + routeDplus" fontSize="14" />
        </CGroup>
        <CGroup verticalAlignment="bottom" textAlignment="right" v-if="hasProfile">
            <CSpan color="gray" :fontFamily="mdiFontFamily" text="mdi-elevation-decline" />
            <CSpan :text="routeDmin" fontSize="14" />
        </CGroup>
    </CanvasLabel>
</template>
<script lang="ts" src="./BottomSheetRouteInfoView.ts" />
