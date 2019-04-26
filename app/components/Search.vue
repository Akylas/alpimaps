<template>

    <!-- <StackLayout>
        <RadAutoCompleteTextView backgroundColor="white" borderRadius="6" ref="autocomplete" displayMode="plain" suggestMode="SuggestAppend" :items="dataItems">
            <SuggestionView ~suggestionView suggestionViewHeight="300">
                <StackLayout v-suggestionItemTemplate orientation="vertical" padding="10">
                    <v-template>
                        <StackLayout verticalAlignment="center">
                            <Label :text="item.text" color="black" fontSize="13" fontWeight="bold" />
                            <Label :text="item.layerName" color="#D0D0D0" fontSize="11" />
                        </StackLayout>
                    </v-template>
                </StackLayout>
            </SuggestionView>
        </RadAutoCompleteTextView>
    </StackLayout> -->
    <MDCardView @loaded="onLoaded" :borderRadius="searchResultsVisible? 10 : 25" margin="10">
        <GridLayout rows="auto,auto" columns="auto, *, auto, auto">
            <MDTextField ref="textField" col="0" colSpan="2" padding="5 15 5 15" row="0" hint="Search" placeholder="search" returnKeyType="search" @focus="onFocus" @blur="onBlur" @textChange="onTextChange" width="100%" backgroundColor="white" />
            <ActivityIndicator v-show="loading" row="0" col="2" busy="true" class="activity-indicator" width="20" height="20" />
            <MDButton variant="text" v-show="currentSearchText && currentSearchText.length > 0" row="0" col="3" fontSize="20" text="x" @tap="clearSearch" width="30" />
            <ListView col="0" row="1" height="200" colSpan="4" rowHeight="49" :items="dataItems" backgroundColor="white" :visibility="searchResultsVisible ?'visible':'collapsed'" @itemTap="onItemTap">
                <v-template>
                    <GridLayout paddingLeft="10" paddingRight="5" columns="auto,*,auto" rows="*,auto" height="50">
                        <Label row="0" col="0"  paddingRight="5" :text="getItemIcon(item) |fonticon" class="maki" color="black" fontSize="20" verticalAlignment="center" />
                        <StackLayout row="0" col="1" verticalAlignment="center">
                            <Label :text="getItemName(item)" color="black" fontSize="14" fontWeight="bold" />
                            <Label :text="getItemAddress(item)" color="#D0D0D0" fontSize="12" />
                        </StackLayout>
                    </GridLayout>
                </v-template>
            </ListView>
        </GridLayout>
    </MDCardView>
</template>

<script lang="ts" src="./Search.ts"></script>
