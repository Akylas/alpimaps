<svelte:options accessors />

<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { lc } from '~/helpers/locale';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Group } from '~/models/Item';
    import MiniSearch from '~/utils/minisearch';

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
        if (!groups) {
            groups = await getMapContext().mapModules['items'].groupsRepository.search();
        }
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

    function setGroupName(name: string) {
        currentGroupText = name;
        closeCallback?.(true);
        dispatch('groupSelected', { group: currentGroupText });
        // currentGroupText = null;
        foundGroups = [];
    }
    function onGroupTap(group) {
        setGroupName(group.name);
    }
    function onKeyboardReturn() {
        setGroupName(currentGroupText);
    }
</script>

<gesturerootview {...$$restProps} {padding} rows="auto,auto,auto,auto" on:layoutChanged={(e) => (closeCallback = e.object['bindingContext']?.closeCallback)}>
    <mdbutton height={30} horizontalAlignment="left" margin="2" text={topGroup} visibility={topGroup ? 'visible' : 'collapsed'} />
    <textfield
        autocapitalizationType="none"
        hint={lc('group')}
        placeholder={lc('group')}
        returnKeyType="done"
        row={1}
        text={defaultGroup}
        variant="outline"
        on:textChange={onTextChange}
        on:returnPress={onKeyboardReturn} />
    {#if foundGroups.length > 0}
        <label row={2} text={lc('existing_groups')} />
        <wraplayout margin={5} row={3}>
            {#each foundGroups as group}
                <mdbutton height={30} margin="2" text={group.name} on:tap={() => onGroupTap(group)} />
            {/each}
        </wraplayout>
    {/if}
</gesturerootview>
