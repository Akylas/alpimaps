<template>
    <ScrollView>
        <StackLayout>
            <MDButton v-for="(action, index) in actions" variant="text" :text="$t(action)" @tap="handleAction(action)" />
            <GridLayout v-for="(option, name) in options" height="50" columns="100,*,50">
                <CanvasLabel colSpan="3" fontSize="13" color="white">
                    <CSpan width="100" :text="name" verticalTextAlignment="center" textAlignment="right" />
                    <CSpan width="50" :text="optionValue(name) / 100" verticalTextAlignment="center" horizontalAligment="right" />
                </CanvasLabel>
                <MDSlider
                    col="1"
                    marginLeft="10"
                    marginRight="10"
                    :value="optionValue(name)"
                    @valueChange="onOptionChanged(name, $event)"
                    :minValue="option.min * 100"
                    :maxValue="option.max * 100"
                    verticalAlignment="center"
                    @tap="noop"
                />
            </GridLayout>
        </StackLayout>
    </ScrollView>
</template>
<script lang="ts" src="./LayerOptionsBottomSheet.ts" />
