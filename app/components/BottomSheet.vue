<template>
    <MDCardView borderRadius="0" elevation="1" rippleColor="transparent">
        <GridLayout ref="bottomSheet" backgroundColor="white" :rows="rows">
            <GridLayout row="0" columns="auto,*" rows="*,auto,auto,*">
                <Label col="0" rowSpan="4" width="40" margin="0 5 0 0" v-show="!!selectedIcon" :text="selectedIcon |fonticon" class="maki" fontSize="24" textAlignment="center" verticalAlignment="center" color="black" />
                <Label col="1" row="1" :text="selectedTitle" color="black" fontSize="16" fontWeight="bold" verticalAlignment="center" textWrap="true" maxLines="2" />
                <Label col="1" row="2" v-show="!!selectedSubtitle" :text="selectedSubtitle" color="#D0D0D0" fontSize="13" verticalAlignment="top" />
            </GridLayout>
            <StackLayout row="1" orientation="horizontal" horizontalAlignment="right" @tap="noop">
                <MDButton class="buttonthemed" @tap="saveItem" text="save item" v-show="item && !item.id" />
                <MDButton class="buttonthemed" @tap="deleteItem" text="delete item" v-show="item && item.id" />
            </StackLayout>
            <transition name="fade" duration="200">
                <CollectionView ref="listView" row="3" rowHeight="49" :items="dataItems" v-show="showListView" isBounceEnabled="false" @tap="noop" @scroll="onListViewScroll">
                    <v-template>
                        <GridLayout columns="30,*" rows="*,auto,auto,*" height="50">
                            <Label col="0" rowSpan="4" :text="getRouteInstructionIcon(item) |fonticon" class="maki" color="black" fontSize="20" verticalAlignment="center" textAlignment="center" />
                            <Label col="1" row="1" :text="getRouteInstructionTitle(item)" color="black" fontSize="14" fontWeight="bold" />
                            <Label col="1" row="2" :text="getRouteInstructionSubtitle(item)" color="#D0D0D0" fontSize="12" />
                        </GridLayout>
                    </v-template>
                </CollectionView>
            </transition>

        </GridLayout>
    </MDCardView>
</template>
<script lang="ts" src="./BottomSheet.ts"/>
