import { InAppBrowser } from '@akylas/nativescript-inappbrowser';
import { lc } from '@nativescript-community/l';
import { Label } from '@nativescript-community/ui-label';
import { AlertDialog, MDCAlertControlerOptions, alert, confirm } from '@nativescript-community/ui-material-dialogs';
import { ActivityIndicator, AlertOptions, StackLayout, Utils, View } from '@nativescript/core';
import { Group } from '~/models/Item';
import { colors, systemFontScale } from '~/variables';
import { NativeViewElementNode, createElement } from 'svelte-native/dom';
import { get } from 'svelte/store';
import { HorizontalPosition, PopoverOptions, VerticalPosition } from '@nativescript-community/ui-popover';
import { closePopover, showPopover } from '@nativescript-community/ui-popover/svelte';

export async function openLink(url) {
    try {
        const { colorPrimary } = get(colors);
        const available = await InAppBrowser.isAvailable();
        if (available) {
            const result = await InAppBrowser.open(url, {
                // iOS Properties
                dismissButtonStyle: 'close',
                preferredBarTintColor: colorPrimary,
                preferredControlTintColor: 'white',
                readerMode: false,
                animated: true,
                enableBarCollapsing: false,
                // Android Properties
                showTitle: true,
                toolbarColor: colorPrimary,
                secondaryToolbarColor: 'white',
                enableUrlBarHiding: true,
                enableDefaultShare: true,
                forceCloseOnRedirection: false
            });
            return result;
        } else {
            Utils.openUrl(url);
        }
    } catch (error) {
        alert({
            title: 'Error',
            message: error.message,
            okButtonText: 'Ok'
        });
    }
}

let loadingIndicator: AlertDialog & { label?: Label };
let showLoadingStartTime: number = null;
function getLoadingIndicator() {
    if (!loadingIndicator) {
        const stack = new StackLayout();
        stack.padding = 10;
        stack.orientation = 'horizontal';
        const activityIndicator = new ActivityIndicator();
        activityIndicator.className = 'activity-indicator';
        activityIndicator.busy = true;
        stack.addChild(activityIndicator);
        const label = new Label();
        label.paddingLeft = 15;
        label.textWrap = true;
        label.verticalAlignment = 'middle';
        label.fontSize = 16;
        stack.addChild(label);
        loadingIndicator = new AlertDialog({
            view: stack,
            cancelable: false
        });
        loadingIndicator.label = label;
    }
    return loadingIndicator;
}
export function showLoading(msg: string = lc('loading')) {
    const loadingIndicator = getLoadingIndicator();
    // console.log('showLoading', msg, !!loadingIndicator);
    loadingIndicator.label.text = msg + '...';
    showLoadingStartTime = Date.now();
    loadingIndicator.show();
}
export function hideLoading() {
    const delta = showLoadingStartTime ? Date.now() - showLoadingStartTime : -1;
    if (delta >= 0 && delta < 1000) {
        setTimeout(() => hideLoading(), 1000 - delta);
        return;
    }
    // log('hideLoading', !!loadingIndicator);
    if (loadingIndicator) {
        loadingIndicator.hide();
    }
}

export async function promptForGroup(defaultGroup: string, groups?: Group[]): Promise<string> {
    const TagView = (await import('~/components/common/TagView.svelte')).default;
    const componentInstanceInfo = resolveComponentElement(TagView, { groups, defaultGroup });
    const modalView: View = componentInstanceInfo.element.nativeView;
    const result = await confirm({ view: modalView, okButtonText: lc('set'), cancelButtonText: lc('cancel') });
    const currentGroupText = componentInstanceInfo.viewInstance['currentGroupText'];
    try {
        modalView._tearDownUI();
        componentInstanceInfo.viewInstance.$destroy(); // don't let an exception in destroy kill the promise callback
    } catch (error) {}
    if (result) {
        return currentGroupText;
    }
    return null;
}

export interface ComponentInstanceInfo {
    element: NativeViewElementNode<View>;
    viewInstance: SvelteComponent;
}

export function resolveComponentElement<T>(viewSpec: typeof SvelteComponent<T>, props?: T): ComponentInstanceInfo {
    const dummy = createElement('fragment', window.document as any);
    const viewInstance = new viewSpec({ target: dummy, props });
    const element = dummy.firstElement() as NativeViewElementNode<View>;
    return { element, viewInstance };
}
export async function showAlertOptionSelect<T>(viewSpec: typeof SvelteComponent<T>, props?: T, options?: Partial<AlertOptions & MDCAlertControlerOptions>) {
    let componentInstanceInfo: ComponentInstanceInfo;
    try {
        componentInstanceInfo = resolveComponentElement(viewSpec, {
            onClose: (result) => {
                view.bindingContext.closeCallback(result);
            },
            onCheckBox(item, value, e) {
                view.bindingContext.closeCallback(item);
            },
            trackingScrollView: 'collectionView',
            ...props
        });
        const view: View = componentInstanceInfo.element.nativeView;
        const result = await alert({
            view,
            okButtonText: lc('cancel'),
            ...(options ? options : {})
        });
        return result;
    } catch (err) {
        throw err;
    } finally {
        componentInstanceInfo.element.nativeElement._tearDownUI();
        componentInstanceInfo.viewInstance.$destroy();
        componentInstanceInfo = null;
    }
}

export async function showPopoverMenu<T = any>({ options, anchor, onClose, props, horizPos, vertPos }: { options; anchor; onClose?; props? } & Partial<PopoverOptions>) {
    const { colorSurfaceContainer } = get(colors);
    const OptionSelect = (await import('~/components/common/OptionSelect.svelte')).default;
    const rowHeight = (props?.rowHeight || 58) * get(systemFontScale);
    const result: T = await showPopover({
        backgroundColor: colorSurfaceContainer,
        view: OptionSelect,
        anchor,
        horizPos: horizPos ?? HorizontalPosition.ALIGN_LEFT,
        vertPos: vertPos ?? VerticalPosition.CENTER,
        props: {
            borderRadius: 10,
            elevation: 4,
            margin: 4,
            backgroundColor: colorSurfaceContainer,
            containerColumns: 'auto',
            rowHeight,
            height: Math.min(rowHeight * options.length, 400),
            width: 150,
            options,
            onClose: (item) => {
                closePopover();
                onClose?.(item);
            },
            ...(props || {})
        }
    });
    return result;
}
