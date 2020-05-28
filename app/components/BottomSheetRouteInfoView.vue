<template>
    <CanvasLabel fontSize="16" color="white" padding="10">
        <CSpan horizontalAlignment="left" verticalAlignment="top" color="#00ff00" fontWeight="bold" fontSize="16" :text="routeDuration" />
        <CGroup verticalAlignment="bottom" textAlignment="left">
            <CSpan color="gray" :fontFamily="mdiFontFamily" text="mdi-map-marker-distance" />
            <CSpan :text="' ' + routeDistance" />
        </CGroup>
        <CGroup verticalAlignment="bottom" textAlignment="center" v-if="hasProfile">
            <CSpan color="gray" :fontFamily="mdiFontFamily" text="mdi-elevation-rise" />
            <CSpan :text="' ' + routeDplus" />
        </CGroup>
        <CGroup verticalAlignment="bottom" textAlignment="right" v-if="hasProfile">
            <CSpan color="gray" :fontFamily="mdiFontFamily" text="mdi-elevation-decline" />
            <CSpan :text="routeDmin" />
        </CGroup>
    </CanvasLabel>
</template>
<script lang="ts" src="./BottomSheetRouteInfoView.ts"/>
