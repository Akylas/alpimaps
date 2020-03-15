<template>
    <GridLayout :columns="columns" rows="*,auto,auto,auto,*" class="details">
        <Label col="0" rowSpan="5" width="40" margin="0 5 0 0" v-show="!!itemIcon" :text="itemIcon |fonticon" class="osm" fontSize="24" textAlignment="center" verticalAlignment="center" color="white" />
        <Label class="details-label" col="1" row="1" :text="itemTitle" color="white" fontSize="16" fontWeight="bold" verticalAlignment="center" textWrap maxLines="2" />
        <Label class="details-label" col="1" row="2" v-show="!!itemSubtitle" :text="itemSubtitle" color="#D0D0D0" fontSize="13" verticalAlignment="top" />
        <Label v-for="(prop, index) in propsToDraw" class="details-label" row="3" :col="index+1" >
            <Span class="details-icon" :text="propIcon(prop)" />
            <Span :text="propValue(prop)" />
        </Label>
        <MDActivityIndicator v-if="updating" rowSpan="5" col="4" busy class="activity-indicator" />
    </GridLayout>
</template>
<script lang="ts" src="./BottomSheetInfoView.ts"/>
