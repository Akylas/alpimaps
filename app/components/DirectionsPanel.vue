<template>
    <GridLayout
        @pan="$emit('pan', $event)"
        android:paddingTop="28"
        :backgroundColor="themeColor"
        rows="50,60,60,50"
        columns="*"
    >
        <MDButton horizontalAlignment="left" variant="flat" class="icon-btn-white" text="mdi-arrow-left" @tap="cancel" />
        <StackLayout orientation="horizontal" horizontalAlignment="center">
            <MDButton
                variant="flat"
                class="icon-btn-white"
                text="mdi-car"
                @tap="setProfile('car')"
                :color="profileColor('car')"
            />
            <MDButton
                variant="flat"
                class="icon-btn-white"
                text="mdi-walk"
                @tap="setProfile('pedestrian')"
                :color="profileColor('pedestrian')"
            />
            <MDButton
                variant="flat"
                class="icon-btn-white"
                text="mdi-bike"
                @tap="setProfile('bicycle')"
                :color="profileColor('bicycle')"
            />
            <MDButton
                variant="flat"
                class="icon-btn-white"
                text="mdi-auto-fix"
                @tap="setProfile('auto_shorter')"
                :color="profileColor('auto_shorter')"
            />
            <MDButton
                variant="flat"
                class="icon-btn-white"
                :text="showOptions ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                @tap="showOptions = !showOptions"
                color="white"
            />
        </StackLayout>
        <MDButton
            horizontalAlignment="right"
            variant="flat"
            class="icon-btn-text icon-btn-rounded "
            text="mdi-magnify"
            @tap="showRoute(false)"
            @LongPress="showRoute(true)"
            :isEnabled="waypoints.length > 0"
            margin="4 10 4 10"
            :visibility="loading ? 'hidden' : 'visible'"
        />
        <MDActivityIndicator v-show="loading" col="2" busy class="activity-indicator" width="44" height="44" color="white" />
        <GridLayout
            row="1"
            colSpan="3"
            class="cardView"
            ripple-color="transparent"
            columns=" *,auto,auto"
            height="44"
            margin="10"
        >
            <MDTextField
                ref="startTF"
                col="0"
                marginLeft="15"
                row="0"
                hint="start"
                returnKeyType="search"
                v-model="currentStartSearchText"
                width="100%"
                color="black"
                variant="none"
                backgroundColor="transparent"
                floating="false"
                verticalAlignment="center"
            />
            <MDActivityIndicator v-show="false" row="0" col="1" busy class="activity-indicator" width="20" height="20" />
            <MDButton
                variant="text"
                class="icon-btn"
                v-show="currentStartSearchText && currentStartSearchText.length > 0"
                row="0"
                col="2"
                text="mdi-close"
                @tap="clearStartSearch"
                color="gray"
            />
        </GridLayout>
        <GridLayout row="2" class="cardView" ripple-color="transparent" columns=" *,auto,auto" height="44" margin="0 10 10 10">
            <MDTextField
                ref="stopTF"
                variant="none"
                col="0"
                color="black"
                marginLeft="15"
                row="0"
                hint="stop"
                v-model="currentStopSearchText"
                returnKeyType="search"
                width="100%"
                backgroundColor="transparent"
                floating="false"
                verticalAlignment="center"
            />
            <MDActivityIndicator v-show="false" row="0" col="1" busy class="activity-indicator" width="20" height="20" />
            <MDButton
                variant="text"
                class="icon-btn"
                v-show="currentStopSearchText && currentStopSearchText.length > 0"
                row="0"
                col="2"
                text="mdi-close"
                @tap="clearStopSearch"
                color="gray"
            />
        </GridLayout>
        <StackLayout orientation="horizontal" row="3" :visibility="showOptions?'visible':'hidden'">
            <MDButton
                variant="flat"
                class="icon-btn-white"
                text="mdi-ferry"
                :color="valhallaSettingColor('use_ferry')"
                @tap="switchValhallaSetting('use_ferry')"
            />
            <MDButton
                variant="flat"
                class="icon-btn-white"
                text="mdi-road"
                v-show="profile === 'bicycle'"
                :color="valhallaSettingColor('use_roads')"
                @tap="switchValhallaSetting('use_roads')"
            />
            <MDButton
                variant="flat"
                class="icon-btn-white"
                text="mdi-chart-areaspline"
                v-show="profile === 'bicycle'"
                :color="valhallaSettingColor('use_hills')"
                @tap="switchValhallaSetting('use_hills')"
            />
            <MDButton
                variant="flat"
                class="icon-btn-white"
                text="mdi-texture-box"
                v-show="profile === 'bicycle'"
                :color="valhallaSettingColor('avoid_bad_surface')"
                @tap="switchValhallaSetting('avoid_bad_surface')"
            />
        </StackLayout>
    </GridLayout>
</template>
<script lang="ts" src="./DirectionsPanel.ts" />
