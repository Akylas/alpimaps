<template>
    <GridLayout rows="*,*" :columns="hasProfile ? '*,*,*' : '*'" class="route-details">
        <Label class="route-details-label" horizontalAlignment="left" color="green" fontWeight="bold" fontSize="16" row="0" col="0" colSpan="3" :text="routeDuration" />
        <Label class="route-details-label" row="1" col="0">
            <Span class="route-details-icon" :text="'mdi-map-marker-distance' | fonticon" />
            <Span :text="routeDistance" />
        </Label>
        <Label class="route-details-label" row="1" col="1" v-show="hasProfile">
            <Span class="route-details-icon" :text="'mdi-elevation-rise' | fonticon" />
            <Span :text="routeDplus" />
        </Label>
        <Label class="route-details-label" row="1" col="2" v-show="hasProfile">
            <Span class="route-details-icon" :text="'mdi-elevation-decline' | fonticon" />
            <Span :text="routeDmin" />
        </Label>
    </GridLayout>
</template>
<script lang="ts" src="./BottomSheetRouteView.ts"/>
