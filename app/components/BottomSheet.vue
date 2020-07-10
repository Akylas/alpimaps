<template>
    <GridLayout ref="bottomSheet" width="100%" rows="70,50,auto,auto" @tap="noop"  @layoutChanged="onLayoutChange">
        <BottomSheetInfoView ref="infoView" row="0" :visibility="itemIsRoute ? 'collapsed' : 'visible'" :item="itemIsRoute ? null : item" />
        <BottomSheetRouteInfoView ref="routeView" row="0" :visibility="itemIsRoute ? 'visible' : 'collapsed'" :routeItem="itemIsRoute ? item : null" />

        <MDActivityIndicator v-show="updatingItem" row="0" horizontalAligment='right' busy class="activity-indicator" />

        <StackLayout row="1" orientation="horizontal" width="100%" @tap="noop" borderTopWidth="1" borderBottomWidth="1" borderColor='#44ffffff'>
            <MDButton variant="text" padding="4" fontSize="10" @tap="searchItemWeb" text="search" v-show="item && !itemIsRoute && !item.id" />
            <MDButton variant="text" padding="4" fontSize="10" @tap="getProfile" text="profile" v-show="itemIsRoute" />
            <MDButton variant="text" padding="4" fontSize="10" @tap="toggleWebView" text="web" />
            <MDButton variant="text" padding="4" fontSize="10" @tap="saveItem" text="save item" v-show="item && !item.id" />
            <MDButton variant="text" padding="4" fontSize="10" @tap="deleteItem" text="delete item" v-show="item && item.id" color="red" />
            <MDButton variant="text" padding="4" fontSize="10" @tap="shareItem" text="share item" v-show="item && item.id" />
        </StackLayout>
        <LineChart ref="graphView" row="2" :height="profileHeight" :visibility="showGraph ? 'visible' : 'collapsed'"  @tap="onChartTap"/>
        <AWebView row="3" :height="webViewHeight" displayZoomControls="false" ref="listView" :visibility="listViewVisible ? 'visible' : 'collapsed'" @scroll="onListViewScroll" :isScrollEnabled="scrollEnabled" :src="webViewSrc"/>
        <!-- <CollectionView id="bottomsheetListView" row="3" ref="listView" rowHeight="40" :items="routeInstructions" :visibility="showListView ? 'visible' : 'hidden'" isBounceEnabled="false" @scroll="onListViewScroll" :isScrollEnabled="scrollEnabled">
            <v-template>
                <GridLayout columns="30,*" rows="*,auto,auto,*" rippleColor="white"  @tap="onInstructionTap(item)">
                    <Label col="0" rowSpan="4" :text="getRouteInstructionIcon(item) |fonticon" class="maki" color="white" fontSize="20" verticalAlignment="center" textAlignment="center" />
                    <Label col="1" row="1" :text="getRouteInstructionTitle(item)" color="white" fontSize="13" fontWeight="bold" textWrap />
                </GridLayout>
            </v-template>
        </CollectionView> -->

    </GridLayout>
</template>
<script lang="ts" src="./BottomSheet.ts"/>
