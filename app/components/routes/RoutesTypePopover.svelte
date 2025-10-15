<script context="module" lang="ts">
    import { lc } from '@nativescript-community/l';
    import { RoutesType } from '~/mapModules/CustomLayersModule';
    import { nutiProps } from '~/stores/mapStore';
    import PopoverBackgroundView from '../common/PopoverBackgroundView.svelte';
    import SettingsCheckbox from '../settings/SettingsCheckbox.svelte';
</script>

<script lang="ts">
    const types = [{
        title:lc('all'),
        type:RoutesType.All
    },{
        title:lc('bicycle'),
        type:RoutesType.Bicycle
    }, {
        title:lc('hiking'),
        type:RoutesType.Hiking
    }]
    function updateProp(value) {
        nutiProps['routes_type'] = value;
    }
    function onTap(event, type) {
         updateProp(type)
    }
    function onCheckBoxTap(item, event) {
         updateProp(item.type)
    }
    function onCheckBox(item, value) {
        if (value) {
            updateProp(item.type);
        }
        
    }
    const routesType = nutiProps.getStore('routes_type');
    

</script>

<PopoverBackgroundView columns="auto">
    <stacklayout width="auto">
        {#each types as type}
        <SettingsCheckbox checkboxProps={{col:0, margin:0, id:type.title, isUserInteractionEnabled:$routesType !== type.type}} mainCol={1} columns="auto,*" fontSize={20} item={{value: $routesType === type.type, ...type}} on:tap={(event) => onTap(event, type.type) }/>
        {/each}
    </stacklayout>
</PopoverBackgroundView>
