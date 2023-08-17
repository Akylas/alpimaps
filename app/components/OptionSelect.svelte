<script lang="ts" context="module">
    import { openFilePicker } from '@nativescript-community/ui-document-picker';
    import { File } from '@nativescript/core';
    import { debounce } from '@nativescript/core/utils';
    import { Template } from 'svelte-native/components';
    import { lc } from '~/helpers/locale';
    import { closeBottomSheet } from '~/utils/svelte/bottomsheet';
    import { actionBarButtonHeight, borderColor, backgroundColor as defaultBackgroundColor, mdiFontFamily, textColor } from '~/variables';
    import IconButton from './IconButton.svelte';
    export interface OptionType {
        name: string;
        isPick?: boolean;
        [k: string]: any;
    }
</script>

<script lang="ts">
    export let showFilter = false;
    export let showBorders = true;
    export let backgroundColor = $defaultBackgroundColor;
    export let rowHeight = 72;
    export let width = 'auto';
    export let fontWeight = 'bold';
    export let options: OptionType[];
    export let onClose = null;
    export let height: number = 350;
    let filteredOptions: OptionType[] = null;
    let filter: string = null;

    function updateFiltered(filter) {
        if (filter) {
            filteredOptions = options.filter((d) => d.name.indexOf(filter) !== -1);
        } else {
            filteredOptions = options;
        }
    }
    const updateFilteredDebounce = debounce(updateFiltered, 500);
    updateFiltered(filter);
    $: updateFilteredDebounce(filter);

    function close(value?: OptionType) {
        (onClose || closeBottomSheet)(value);
    }

    async function onTap(item: OptionType, args) {
        if (item.isPick) {
            try {
                const result = await openFilePicker({
                    extensions: ['file/*'],
                    multipleSelection: false,
                    pickerMode: 0
                });
                if (File.exists(result.files[0])) {
                    const file = File.fromPath(result.files[0]);
                    close({ name: file.name, data: { url: file.path }, isPick: true });
                } else {
                    close(null);
                }
            } catch (err) {
                close(null);
            }
        } else {
            close(item);
        }
    }
    function blurTextField() {}
</script>

<gesturerootview {height} rows="auto,*" {backgroundColor} columns={`${width}`} {...$$restProps}>
    {#if showFilter}
        <gridlayout margin="10 10 0 10" borderColor={$borderColor}>
            <textfield
                variant="outline"
                padding="0 30 0 20"
                hint={lc('search')}
                placeholder={lc('search')}
                returnKeyType="search"
                on:returnPress={blurTextField}
                height={actionBarButtonHeight}
                text={filter}
                on:textChange={(e) => (filter = e['value'])}
                backgroundColor="transparent"
                autocapitalizationType="none"
                verticalTextAlignment="center"
            />

            <IconButton
                gray={true}
                isHidden={!filter || filter.length === 0}
                col={1}
                text="mdi-close"
                on:tap={() => (filter = null)}
                verticalAlignment="middle"
                horizontalAlignment="right"
                size={40}
            />
        </gridlayout>
    {/if}
    <collectionView row={1} items={filteredOptions} {rowHeight}>
        <Template let:item>
            <canvaslabel padding={16} color={item.color || $textColor} rippleColor={item.color || $textColor} on:tap={(event) => onTap(item, event)}>
                <cspan verticalAlignment="middle" textAlignment="left" text={item.icon} fontSize={16} visibility={item.icon ? 'visible' : 'hidden'} fontFamily={mdiFontFamily} />
                <cspan verticalAlignment="middle" textAlignment="left" text={item.name} {fontWeight} fontSize={16} paddingLeft={item.icon ? 30 : 0} />
                {#if showBorders}
                    <line height={1} color={$borderColor} strokeWidth={1} startX={0} verticalAlignment="bottom" startY={0} stopX="100%" stopY={0} />
                {/if}
            </canvaslabel>
        </Template>
    </collectionView>
</gesturerootview>
