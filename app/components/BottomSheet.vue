<template>
    <GridLayout ref="bottomSheet" elevation="1" width="100%" :rows="rows" @tap="noop">
        <BottomSheetInfoView ref="infoView" row="0" :visibility="itemIsRoute ? 'collapsed' : 'visible'" :updating="updatingItem" :item="itemIsRoute ? null : item" />
        <BottomSheetRouteInfoView ref="routeView" row="0" :visibility="itemIsRoute ? 'visible' : 'collapsed'" :routeItem="itemIsRoute ? item : null" />

        <StackLayout row="1" orientation="horizontal" width="100%" @tap="noop" borderTopWidth="1" borderBottomWidth="1" borderColor='#44ffffff'>
            <MDButton variant="text" padding="4" fontSize="10" @tap="searchItemWeb" text="search" v-show="item && !item.id" />
            <MDButton variant="text" padding="4" fontSize="10" @tap="getProfile" text="profile" v-show="itemRouteNoProfile" />
            <MDButton variant="text" padding="4" fontSize="10" @tap="saveItem" text="save item" v-show="item && !item.id" />
            <MDButton variant="text" padding="4" fontSize="10" @tap="deleteItem" text="delete item" v-show="item && item.id" />
        </StackLayout>
        <!-- <transition name="fade" duration="200"> -->
            <LineChart ref="graphView" row="2"  :visibility="showGraph ? 'visible' : 'hidden'" />

            <!-- <Palette v-tkCartesianPalette seriesName="Area">
                <PaletteEntry v-tkCartesianPaletteEntry fillColor="#8060B3FC" strokeWidth="2" strokeColor="#60B3FC" />
            </Palette>
            <CategoricalAxis v-tkCartesianHorizontalAxis majorTickInterval="1000" labelTextColor="transparent" />
            <LinearAxis v-tkCartesianVerticalAxis firstLabelVisibility="Hidden" labelFormat="%.0f" />
            <AreaSeries v-tkCartesianSeries seriesName="Area" selectionMode="DataPoint" :items="routeElevationProfile" categoryProperty="x" valueProperty="y" @pointSelected="onChartSelected" />
        </RadCartesianChart> -->

        <CollectionView row="3" ref="listView" rowHeight="49" :items="routeInstructions" :visibility="showListView ? 'visible' : 'hidden'" isBounceEnabled="false" @itemTap="onInstructionTap" @scroll="onListViewScroll" :isScrollEnabled="scrollEnabled">
            <v-template>
                <GridLayout columns="30,*" rows="*,auto,auto,*" height="50">
                    <Label col="0" rowSpan="4" :text="getRouteInstructionIcon(item) |fonticon" class="maki" color="white" fontSize="20" verticalAlignment="center" textAlignment="center" />
                    <Label col="1" row="1" :text="getRouteInstructionTitle(item)" color="white" fontSize="13" fontWeight="bold" textWrap />
                    <!-- <Label col="1" row="2" :text="getRouteInstructionSubtitle(item)" color="#D0D0D0" fontSize="12" /> -->
                </GridLayout>
            </v-template>
        </CollectionView>

        <!-- </transition> -->
        <!-- <transition name="fade" duration="200"> -->
        <!-- </transition> -->
    </GridLayout>
</template>
<script lang="ts" src="./BottomSheet.ts"/>
