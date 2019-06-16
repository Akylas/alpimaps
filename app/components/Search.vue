<template>
    <StackLayout>
        <MDCardView @loaded="onLoaded" :borderRadius="searchResultsVisible? 10 : 25" margin="10" isUserInteractionEnabled="false">
            <GridLayout rows="44,auto" columns="auto, *, auto, auto, auto" backgroundColor="white">
                <MDButton variant="flat" class="icon-btn" :text="'mdi-menu' | fonticon" @tap="showMenu('left')" />
                <MDTextField ref="textField" col="1" padding="8 15 8 0" row="0" hint="Search" placeholder="search" returnKeyType="search" @focus="onFocus" @blur="onBlur" @textChange="onTextChange" width="100%" backgroundColor="transparent" floating="false" verticalAlignment="center" />
                <MDActivityIndicator v-show="loading" row="0" col="2" busy="true" class="activity-indicator" width="20" height="20" />
                <MDButton variant="text" class="icon-btn" v-show="currentSearchText && currentSearchText.length > 0" row="0" col="3" :text="'mdi-close' | fonticon" @tap="clearSearch"  color="gray"/>
                <MDButton col="4" variant="flat" class="icon-btn" :text="'mdi-layers' | fonticon" @tap="showMenu('right')" />

                <CollectionView col="0" row="1" height="200" colSpan="4" rowHeight="49" :items="dataItems" v-show="searchResultsVisible" @itemTap="onItemTap">
                    <v-template>
                        <GridLayout columns="30,*" rows="*,auto,auto,*" height="50">
                            <Label col="0" rowSpan="4" :text="getItemIcon(item) |fonticon" class="maki" color="black" fontSize="20" verticalAlignment="center" textAlignment="center" />
                            <Label col="1" row="1" :text="getItemTitle(item)" color="black" fontSize="14" fontWeight="bold" />
                            <Label col="1" row="2" :text="getItemSubtitle(item)" color="#D0D0D0" fontSize="12" />
                        </GridLayout>
                    </v-template>
                </CollectionView>
            </GridLayout>
        </MDCardView>
    </StackLayout>
</template>
<script lang="ts" src="./Search.ts"/>
