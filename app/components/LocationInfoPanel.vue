<template>
    <GridLayout
        width="200"
        v-show="mShowLocationInfo"
        height="70"
        borderRadius="40"
        backgroundColor="#77000000"
        padding="6"
        columns="auto,*,auto"
        @swipe="showLocationInfo = false"
    >
        <CanvasLabel
            width="60"
            height="60"
            borderRadius="30"
            borderWidth="4"
            :borderColor="accentColor"
            backgroundColor="#aaffffff"
        >
            <CGroup verticalAlignment="middle" textAlignment="center">
                <CSpan
                    :text="
                        (currentLocation && currentLocation.speed !== undefined ? currentLocation.speed.toFixed() : '-') + '\n'
                    "
                    fontSize="26"
                    fontWeight="bold"
                />
                <CSpan text="km/h" fontSize="10" />
            </CGroup>
        </CanvasLabel>
        <CanvasLabel col="1" marginLeft="5" color="#fff">
            <CSpan
                :text="$tu('altitude') + (listeningForBarometer ? `(${$t('barometer')})` : '') + '\n'"
                fontSize="11"
                :color="accentColor"
                verticalAlignment="top"
            />
            <CGroup verticalAlignment="middle">
                <CSpan :text="currentAltitude" fontSize="20" fontWeight="bold" />
                <CSpan text=" m" fontSize="12" />
            </CGroup>
        </CanvasLabel>
        <label
            col="1"
            v-show="listeningForBarometer && airportRefName"
            :text="airportRefName"
            verticalAlignment="bottom"
            horizontalAlignment="right"
            color="#fff"
            fontSize="9"
        />
        <StackLayout v-show="hasBarometer" col="2" verticalAlignment="center">
            <MDButton variant="text" class="small-icon-btn" text="mdi-gauge" @tap="switchBarometer" color="white" />
            <MDButton
                variant="text"
                class="small-icon-btn"
                v-show="listeningForBarometer"
                text="mdi-reflect-vertical"
                @tap="getNearestAirportPressure"
                color="white"
            />
        </StackLayout>
    </GridLayout>
</template>
<script lang="ts" src="./LocationInfoPanel.ts" />
