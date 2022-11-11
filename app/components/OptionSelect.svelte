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
    import { borderColor,primaryColor } from '~/variables';

    export let options: OptionType[];

    export let height: number = 350;

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
</script>

<collectionView row={1} items={options} {height} rowHeight={72}>
    <Template let:item>
        <canvaslabel padding={16} rippleColor={primaryColor} on:tap={(event) => onTap(item, event)}>
            <cspan verticalAlignment="middle" textAlignment="left" text={item.name} fontWeight="bold" fontSize={16} />
            <line height={1} color={$borderColor} strokeWidth={1} startX={0} verticalAlignment="bottom" startY={0} stopX="100%" stopY={0} />
        </canvaslabel>
    </Template>
</collectionView>
