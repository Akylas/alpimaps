<script lang="ts" context="module">
    export interface OptionType {
        name: string;
        isPick?: boolean;
        [k: string]: any;
    }
</script>

<script lang="ts">
    import { openFilePicker } from '@nativescript-community/ui-document-picker';
    import { File } from '@nativescript/core';
    import { Template } from 'svelte-native/components';
    import { closeBottomSheet } from '~/utils/svelte/bottomsheet';
    import { backgroundColor, borderColor, primaryColor } from '~/variables';
    import { slc } from '~/helpers/locale';
    import IconButton from './IconButton.svelte';

    export let showFilter = false;
    export let options: OptionType[];
    let filteredOptions: OptionType[] = null;
    let filter: string = null;

    export let height: number = 350;

    function updateFiltered(filter) {
        if (filter) {
            filteredOptions = options.filter((d) => d.name.indexOf(filter) !== -1);
        } else {
            filteredOptions = options;
        }
    }

    $: updateFiltered(filter);

    function close(value?: OptionType) {
        closeBottomSheet(value);
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

<gridlayout {height} rows="auto,*" backgroundColor={$backgroundColor}>
    <gridlayout columns="*,auto" margin={10} borderColor={$borderColor} visibility={showFilter ? 'visible' : 'collapsed'}>
        <textfield
            variant="none"
            padding="0 15 0 0"
            hint={$slc('search')}
            placeholder={$slc('search')}
            returnKeyType="search"
            on:return={blurTextField}
            text={filter}
            on:textChange={(e) => (filter = e['value'])}
            backgroundColor="transparent"
            autocapitalizationType="none"
            floating="false"
            verticalTextAlignment="center"
        />

        <IconButton gray={true} isHidden={filter && filter.length > 0} col={1} text="mdi-close" on:tap={() => (filter = null)} />
    </gridlayout>
    <collectionView row={1} items={filteredOptions} rowHeight={72}>
        <Template let:item>
            <canvaslabel padding={16} rippleColor={primaryColor} on:tap={(event) => onTap(item, event)}>
                <cspan verticalAlignment="middle" textAlignment="left" text={item.name} fontWeight="bold" fontSize={16} />
                <line height={1} color={$borderColor} strokeWidth={1} startX={0} verticalAlignment="bottom" startY={0} stopX="100%" stopY={0} />
            </canvaslabel>
        </Template>
    </collectionView>
</gridlayout>
