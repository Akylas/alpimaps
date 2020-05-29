<template>
    <GridLayout
        @loaded="onLoaded"
        rows="44,auto"
        columns="auto, *, auto, auto, auto, auto, auto"
        :backgroundColor="hasFocus ? '#99000000' : '#55000000'"
        :borderRadius="searchResultsVisible ? 10 : 25"
        margin="10"
    >
        <MDButton variant="flat" class="icon-btn" text="mdi-menu" @tap="showMenu('left')" color="white" />
        <MDTextField
            ref="textField"
            variant="none"
            col="1"
            padding="0 15 0 0"
            row="0"
            hint="Search"
            placeholder="search"
            returnKeyType="search"
            @focus="onFocus"
            @blur="onBlur"
            @textChange="onTextChange"
            width="100%"
            backgroundColor="transparent"
            autocapitalizationType="none"
            floating="false"
            verticalAlignment="center"
            color="white"
        />
        <MDActivityIndicator v-show="loading" row="0" col="2" busy class="activity-indicator" width="20" height="20" />
        <MDButton
            variant="text"
            class="icon-btn"
            v-show="searchResultsVisible"
            row="0"
            col="3"
            text="mdi-shape"
            @tap="toggleFilterOSMKey"
            :color="filteringOSMKey? themeColor: 'lightgray'"
        />
        <MDButton
            variant="text"
            class="icon-btn"
            v-show="searchResultsVisible"
            row="0"
            col="4"
            text="mdi-map"
            @tap="showResultsOnMap"
            color="lightgray"
        />
        <MDButton
            variant="text"
            class="icon-btn"
            v-show="currentSearchText && currentSearchText.length > 0"
            row="0"
            col="5"
            text="mdi-close"
            @tap="clearSearch"
            color="lightgray"
        />

        <MDButton col="6" variant="flat" class="icon-btn" text="mdi-layers" @tap="showMapMenu" color="white" />

        <CollectionView
            col="0"
            row="1"
            height="200"
            colSpan="7"
            rowHeight="49"
            :items="listItems"
            :visibility="searchResultsVisible ? 'visible' : 'collapsed'"
        >
            <v-template>
                <GridLayout columns="30,*" rows="*,auto,auto,*" rippleColor="white" @tap="onItemTap(item)">
                    <Label
                        col="0"
                        rowSpan="4"
                        :text="getItemIcon(item) | fonticon"
                        :color="getItemIconColor(item)"
                        class="maki"
                        fontSize="20"
                        verticalAlignment="center"
                        textAlignment="center"
                    />
                    <Label col="1" row="1" :text="getItemTitle(item)" color="white" fontSize="14" fontWeight="bold" />
                    <Label col="1" row="2" :text="getItemSubtitle(item)" color="#D0D0D0" fontSize="12" />
                </GridLayout>
            </v-template>
        </CollectionView>
    </GridLayout>
</template>
<script lang="ts" src="./Search.ts" />
