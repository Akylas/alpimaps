<template>
    <GridLayout columns="*,auto" @tap="noop" width="70%" verticalAlignment="bottom">
        <CollectionView col="0" rowHeight="49" :items="customSources" @tap="noop">
            <v-template>
                <GridLayout paddingLeft="15" paddingRight="5" rows="*,auto" columns="*,auto" @longPress="showSourceOptions(item)">
                    <Label
                        row="0"
                        :text="item.name.toUpperCase()"
                        :color="item.layer.opacity === 0 ? 'grey' : 'white'"
                        fontSize="13"
                        fontWeight="bold"
                        verticalAlignment="bottom"
                    />
                    <MDSlider
                        row="1"
                        marginLeft="10"
                        marginRight="10"
                        :value="Math.round(item.layer.opacity * 100)"
                        @valueChange="onLayerOpacityChanged(item, $event)"
                        minValue="0"
                        maxValue="100"
                        verticalAlignment="center"
                        @tap="noop"
                    />
                    <MDButton
                        col="1"
                        rowSpan="2"
                        color="white"
                        rippleColor="white"
                        variant="text"
                        class="icon-btn"
                        text="mdi-dots-vertical"
                        @tap="showSourceOptions(item)"
                    />
                </GridLayout>
            </v-template>
        </CollectionView>
        <!-- <ScrollView> -->
        <StackLayout col="1" borderLeftColor="rgba(255,255,255,0.4)" borderLeftWidth="1">
            <MDButton variant="text" class="icon-btn" text="mdi-plus" @tap="addSource" />
            <MDButton variant="text" class="icon-btn" text="mdi-layers-off" @tap="clearCache" />
            <!-- <MDButton class="buttonthemed" @tap="addSource" :text="$t('add_source')" /> -->
            <!-- <MDButton class="buttonthemed" @tap="clearCache" :text="$t('clear_cache')" /> -->
            <!-- <MDButton class="buttonthemed" @tap="selectLocalMbtilesFolder" :text="$t('select_local_folder')" /> -->
            <MDButton
                variant="text"
                class="icon-btn"
                text="mdi-domain"
                :color="mshow3DBuildings ? themeColor : 'gray'"
                @tap="toggle3DBuildings"
            />

            <MDButton
                variant="text"
                class="icon-btn"
                text="mdi-signal"
                :color="mshowContourLines ? themeColor : 'gray'"
                @tap="toggleContourLines"
            />
            <MDButton
                variant="text"
                class="icon-btn"
                text="mdi-globe-model"
                :color="mshowGlobe ? themeColor : 'gray'"
                @tap="toggleGlobe"
            />

            <MDButton
                variant="text"
                class="icon-btn"
                text="mdi-map-clock"
                v-show="packageServiceEnabled"
                :color="mpreloading ? themeColor : 'gray'"
                @tap="togglePreloading"
            />
        </StackLayout>

        <!-- <GridLayout v-show="currentLegend" rows="auto,*" columns="auto,*" backgroundColor="white">
                <WebView rowSpan="2" colSpan="2" v-if="currentLegend" :src="currentLegend" @scroll="onListViewScroll"  />
                <MDButton variant="flat" class="icon-btn" text="mdi-arrow-left" @tap="currentLegend = null" />
            </GridLayout> -->
    </GridLayout>
</template>
<script lang="ts" src="./MapRightMenu.ts" />
