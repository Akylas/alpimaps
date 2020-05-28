<template>
    <CanvasLabel :columns="columns" rows="*,auto,auto,auto,*"  fontSize="16" color="white" padding="10">
        <CSpan paddingLeft="5" width="40" v-if="!!itemIcon" :text="itemIcon |fonticon" fontFamily="maki" fontSize="24" verticalAlignment="middle" />
        <CGroup paddingLeft="30" paddingBottom="10" verticalAlignment="middle" textAlignment="left">
            <CSpan :text="itemTitle" fontWeight="bold" maxLines="2" />
            <CSpan :text="itemSubtitle ? '\n' + itemSubtitle : ''" color="#D0D0D0" fontSize="13" />
        </CGroup>
        <CGroup fontSize="14" v-for="(prop, index) in propsToDraw" :paddingLeft="30 + (index * 60)"  verticalAlignment="bottom" textAlignment="left">
            <CSpan :fontFamily="mdiFontFamily" color="gray" :text="propIcon(prop)" />
            <CSpan :text="propValue(prop)" />
        </CGroup>
    </CanvasLabel>
</template>
<script lang="ts" src="./BottomSheetInfoView.ts"/>
