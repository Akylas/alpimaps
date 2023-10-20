<script lang="ts">
    import { Template } from 'svelte-native/components';

    export let options: { name: string; checked: boolean }[];
</script>

<collectionview height={200} items={options} rowHeight={50}>
    <Template let:item>
        <gridlayout class="list-group-item" columns="*, auto" orientation="horizontal" padding={10}>
            <label fontSize={18} text={item.name} verticalAlignment="middle" />
            <switch checked={item.checked} col={1} verticalAlignment="middle" on:checkedChange={(event) => (item.checked = event.value)} ios:backgroundColor="#f27743" />
        </gridlayout>
    </Template>
</collectionview>
