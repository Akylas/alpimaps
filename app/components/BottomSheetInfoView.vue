<template>
    <CanvasLabel fontSize="16" color="white" padding="5 5 5 5" @longPress="showRawData">
        <CSpan
            paddingLeft="10"
            width="40"
            v-if="!!itemIcon"
            :text="itemIcon | fonticon"
            fontFamily="osm"
            fontSize="24"
            verticalAlignment="middle"
            :paddingBottom="itemSubtitle ? 10 : 0 + propsToDraw.length > 0 ? 5 : 0"
        />
        <CGroup
            paddingLeft="40"
            :paddingBottom="itemSubtitle ? 10 : 0 + propsToDraw.length > 0 ? 5 : 0"
            verticalAlignment="middle"
            textAlignment="left"
        >
            <CSpan :text="itemTitle" fontWeight="bold" />
            <CSpan :text="itemSubtitle ? '\n' + itemSubtitle : ''" color="#D0D0D0" fontSize="13" />
        </CGroup>
        <CGroup
            fontSize="14"
            v-for="(prop, index) in propsToDraw"
            :paddingLeft="5 + index * 60"
            
            verticalAlignment="bottom"
            textAlignment="left"
        >
            <CSpan :fontFamily="mdiFontFamily" color="gray" :text="propIcon(prop)" />
            <CSpan :text="propValue(prop)"/>
        </CGroup>
    </CanvasLabel>
</template>
<script lang="ts" src="./BottomSheetInfoView.ts" />
