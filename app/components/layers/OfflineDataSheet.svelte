<script lang="ts">
    import { formatSize } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { ARCHIVE_ROLE_ICONS, archiveRoleLabel, archivesSummary } from './offlineData';
    import { showError } from '@shared/utils/showError';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import Pill from '~/components/common/Pill.svelte';
    import { localInventory } from '~/mapModules/CustomLayersModule';
    import { LOCAL_DATA_FOLDER_PICKABLE, pickLocalDataFolder } from '~/mapModules/localData/folder';
    import { disabledLocalData, setLocalDataEnabled } from '~/mapModules/localData/scan';
    import { getMapContext } from '~/mapModules/MapModule';
    import { getSavedMBTilesDir } from '~/utils/utils';
    import { colors, fonts } from '~/variables';

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    const customLayers = getMapContext().mapModule('customLayers');
    let scanning = false;

    $: world = $localInventory?.world ?? [];
    $: regions = $localInventory?.regions ?? [];
    $: rows = [
        ...world.map((archive) => ({
            id: archive.id,
            section: 'world',
            icon: ARCHIVE_ROLE_ICONS[archive.role],
            title: archiveRoleLabel(archive.role),
            subtitle: `${archive.name} · ${formatSize(archive.size)}`
        })),
        ...regions.map((region) => ({ id: region.id, section: 'regions', icon: 'mdi-map-marker-radius-outline', title: region.name, subtitle: archivesSummary(region.archives) }))
    ];

    async function reload(folder?: string) {
        scanning = true;
        try {
            await customLayers.loadLocalData(folder);
        } finally {
            scanning = false;
        }
    }
    async function changeFolder() {
        try {
            const folder = await pickLocalDataFolder();
            if (folder) {
                await reload(folder);
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<gesturerootview class="bottomsheet" {...$$restProps} height={480} rows="auto,auto,*">
    <PanelHeader icon="mdi-database-outline" subtitle={$localInventory?.folder ?? getSavedMBTilesDir()} title={lc('offline_data')} />
    <wraplayout padding="0 12" row={1}>
        <Pill icon="mdi-refresh" isEnabled={!scanning} label={lc('rescan')} on:tap={() => reload()} />
        {#if LOCAL_DATA_FOLDER_PICKABLE}
            <Pill icon="mdi-folder-open-outline" label={lc('change_folder')} on:tap={changeFolder} />
        {/if}
    </wraplayout>
    <scrollview row={2}>
        <stacklayout padding="0 4 12 4">
            {#if !rows.length}
                <label color={colorOnSurfaceVariant} fontSize={15} padding="16" text={lc('offline_data_none')} textAlignment="center" />
            {/if}
            {#each rows as row, index (row.id)}
                {#if index === 0 || rows[index - 1].section !== row.section}
                    <label class="sectionHeader" text={lc(row.section)} />
                {/if}
                <gridlayout columns="auto,*,auto" padding="6 16" rippleColor={colorPrimary} on:tap={() => setLocalDataEnabled(row.id, $disabledLocalData.has(row.id))}>
                    <label color={$disabledLocalData.has(row.id) ? colorOnSurfaceVariant : colorPrimary} fontFamily={$fonts.mdi} fontSize={22} text={row.icon} verticalAlignment="middle" width={32} />
                    <stacklayout col={1} paddingLeft={8} verticalAlignment="middle">
                        <label color={$disabledLocalData.has(row.id) ? colorOnSurfaceVariant : colorOnSurface} fontSize={15} lineBreak="end" maxLines={1} text={row.title} />
                        <label color={colorOnSurfaceVariant} fontSize={12} lineBreak="middle" maxLines={1} text={row.subtitle} />
                    </stacklayout>
                    <!-- the row takes the tap: a switch tap would also reach it and toggle twice -->
                    <switch checked={!$disabledLocalData.has(row.id)} col={2} isUserInteractionEnabled={false} marginLeft={10} verticalAlignment="middle" />
                </gridlayout>
            {/each}
            {#if rows.length}
                <label color={colorOnSurfaceVariant} fontSize={13} padding="12 16 0 16" text={lc('offline_data_order')} textWrap={true} />
            {/if}
        </stacklayout>
    </scrollview>
</gesturerootview>
