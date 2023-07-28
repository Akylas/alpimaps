<svelte:options accessors />

<script lang="ts">
    import { lc } from '~/helpers/locale';
    import { primaryColor } from '~/variables';
    import MiniSearch from '~/utils/minisearch';
    import { Group } from '~/models/Item';
    import { getMapContext } from '~/mapModules/MapModule';
    import { createEventDispatcher, onMount } from 'svelte';

    const dispatch = createEventDispatcher();
    let closeCallback: Function;
    let foundGroups: Group[] = [];
    export let topGroup: string = null;
    export let defaultGroup: string = null;
    export let currentGroupText: string = null;
    export let groups = null;
    export let showDefaultGroups = true;
    export let padding: string | number = 20;

    const miniSearch = new MiniSearch({
        fields: ['name'], // fields to index for full-text search
        storeFields: ['name']
    });

    onMount(async () => {
        console.log('onMount', groups);
        if (!groups) {
            groups = await getMapContext().mapModules['items'].groupsRepository.search();
        }
        console.log('onMount1', groups);
        if (showDefaultGroups) {
            foundGroups = groups.slice(0, 4);
        }
        miniSearch.addAll(groups);
        if (defaultGroup) {
            currentGroupText = defaultGroup;
            foundGroups = miniSearch.search(currentGroupText, { fuzzy: 0.2 }) as any as Group[];
        }
    });
    function onTextChange(e) {
        currentGroupText = e['value'];
        foundGroups = miniSearch.search(currentGroupText, { fuzzy: 0.2 }) as any as Group[];
        if (groups && foundGroups.length === 0 && showDefaultGroups) {
            foundGroups = groups.slice(0, 4);
        }
    }

    function setGroupName(name:string) {
        currentGroupText = name;
        closeCallback?.(true);
        dispatch('groupSelected', {group:currentGroupText})
        currentGroupText = null;
        foundGroups = [];
    }
    function onGroupTap(group) {
        setGroupName(group.name)
    }
    function onKeyboardReturn() {
        console.log('onKeyboardReturn')
        setGroupName(currentGroupText)
    }
</script>

<gesturerootview {...$$restProps} rows="auto,auto,auto" {padding} on:layoutChanged={(e) => (closeCallback = e.object['bindingContext']?.closeCallback)}>
    <mdbutton text={topGroup} height={30} margin="2" visibility={topGroup?'visible':'collapsed'} horizontalAlignment="left"/>
    <textfield
        row={1}
        variant="outline"
        autocapitalizationType="none"
        hint={lc('group')}
        placeholder={lc('group')}
        returnKeyType="done"
        text={defaultGroup}
        on:textChange={onTextChange}
        on:returnPress={onKeyboardReturn}
    />
    <wraplayout row={2} margin={5} on:tap={() => console.log('tap2')}>
        {#each foundGroups as group}
            <mdbutton text={group.name} height={30} margin="2" on:tap={() => onGroupTap(group)} />
        {/each}
    </wraplayout>
</gesturerootview>
