<template>
    <GridLayout rows="*,*" :columns="hasProfile ? '*,*,*' : '*'" class="details">
        <Label class="details-label" horizontalAlignment="left" color="green" fontWeight="bold" fontSize="16" row="0" col="0" colSpan="3" :text="routeDuration" />
        <Label class="details-label" row="1" col="0">
            <Span class="details-icon" text="mdi-map-marker-distance" />
            <Span :text="routeDistance" />
        </Label>
        <Label class="details-label" row="1" col="1" v-show="hasProfile">
            <Span class="details-icon" text="mdi-elevation-rise" />
            <Span :text="routeDplus" />
        </Label>
        <Label class="details-label" row="1" col="2" v-show="hasProfile">
            <Span class="details-icon" text="mdi-elevation-decline" />
            <Span :text="routeDmin" />
        </Label>
    </GridLayout>
</template>
<script lang="ts" src="./BottomSheetRouteInfoView.ts"/>
