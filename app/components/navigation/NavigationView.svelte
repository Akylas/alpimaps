<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { DismissReasons } from '@nativescript-community/ui-snackbar';
    import type { EventData } from '@nativescript/core';
    import { onDestroy } from 'svelte';
    import NavigationDock from '~/components/navigation/NavigationDock.svelte';
    import { NavigationReroutedEvent, navigationService } from '~/services/NavigationService';
    import { showSnack } from '~/utils/ui';

    async function onRerouted(event: EventData & { data?: { auto: boolean } }) {
        if (!event.data?.auto) {
            return;
        }
        const result = await showSnack({ message: lc('navigation_rerouted'), actionText: lc('navigation_undo_reroute'), hideDelay: 10000 });
        if (result?.reason === DismissReasons.ACTION) {
            navigationService.undoReroute();
        }
    }
    navigationService.on(NavigationReroutedEvent, onRerouted);
    onDestroy(() => navigationService.off(NavigationReroutedEvent, onRerouted));
</script>

<!-- the sheet is the dock: what the user wants to see while navigating is in its pages -->
<NavigationDock {...$$restProps} />
