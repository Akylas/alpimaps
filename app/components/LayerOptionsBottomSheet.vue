<template>
    <ScrollView>
        <StackLayout>
            <MDButton v-for="(action, index) in actions" variant="text" :text="$t(action)" @tap="handleAction(action)"/>
            <GridLayout v-for="(option, name) in options" height="50" columns="auto,*,auto">
                <Label col="0" width="100" :text="name" color="white" fontSize="13" verticalTextAlignment="center" />
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
                <Label col="2" width="50" :text="optionValue(name) /100" color="white" fontSize="13" verticalTextAlignment="center" />
            </GridLayout>
        </StackLayout>
    </ScrollView>
</template>
<script lang="ts" src="./LayerOptionsBottomSheet.ts" />
 