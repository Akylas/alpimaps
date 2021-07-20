<script lang="ts">
    import { Template } from 'svelte-native/components';

    export let options: { name: string; checked: boolean }[];
</script>

<collectionview items={options} rowHeight="50" height="200">
    <Template let:item>
        <gridlayout columns="*, auto" class="list-group-item" orientation="horizontal" padding="10">
            <label fontSize="18" text={item.name}  verticalAlignment="center" />
            <switch
                col={1}
                ios:backgroundColor="#f27743"
                checked={item.checked}
                on:onCheckedChange={(event) => (item.checked = event.value)}
                verticalAlignment="center" />
        </gridlayout>
    </Template>
</collectionview>
