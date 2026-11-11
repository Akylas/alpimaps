<script lang="ts">
    // the pages of the navigation dock: which are on, and in what order. The order is the one of the swipe
    import { lc } from '@nativescript-community/l';
    import { Template } from '@nativescript-community/svelte-native/components';
    import IconButton from '~/components/common/IconButton.svelte';
    import { routeFeatures, routeNavPageChoices } from '~/routeFeatures/registry';
    import { navigationPageIds, navigationPages } from '~/stores/navigationStore';
    import { colors } from '~/variables';

    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant } = $colors);

    const ROW_HEIGHT = 56;

    interface PageRow {
        id: string;
        label: string;
        on: boolean;
    }
    let rows: PageRow[] = routeNavPageChoices($routeFeatures, $navigationPageIds).map((page) => ({ id: page.id, label: page.label(), on: $navigationPageIds.includes(page.id) }));

    // the setting holds the pages that are on, in the order they are shown in here
    function save(next: PageRow[]) {
        rows = next;
        navigationPages.set(next.filter((row) => row.on).map((row) => row.id).join(','));
    }
    function toggle(index: number, on: boolean) {
        if (rows[index].on !== on) {
            save(rows.map((row, position) => (position === index ? { ...row, on } : row)));
        }
    }
    function move(index: number, step: number) {
        const target = index + step;
        if (target < 0 || target >= rows.length) {
            return;
        }
        const next = rows.slice();
        [next[index], next[target]] = [next[target], next[index]];
        save(next);
    }
</script>

<gesturerootview class="bottomsheet" height={rows.length * ROW_HEIGHT + 24}>
    <collectionview id="scrollView" ios:contentInsetAdjustmentBehavior={2} itemIdGenerator={(item) => item.id} items={rows} rowHeight={ROW_HEIGHT}>
        <Template let:index let:item>
            <gridlayout borderBottomColor={colorHairline} borderBottomWidth={1} columns="*,auto,auto,auto" padding="0 16">
                <label color={item.on ? colorOnSurface : colorOnSurfaceVariant} fontSize={16} text={item.label} verticalAlignment="center" />
                <IconButton col={1} color={colorOnSurfaceVariant} opacity={index === 0 ? 0.3 : 1} text="mdi-arrow-up" tooltip={lc('move_up')} on:tap={() => move(index, -1)} />
                <IconButton col={2} color={colorOnSurfaceVariant} opacity={index === rows.length - 1 ? 0.3 : 1} text="mdi-arrow-down" tooltip={lc('move_down')} on:tap={() => move(index, 1)} />
                <switch checked={item.on} col={3} marginLeft={8} verticalAlignment="center" on:checkedChange={(event) => toggle(index, event.value)} />
            </gridlayout>
        </Template>
    </collectionview>
</gesturerootview>
