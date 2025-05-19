import { restartApp } from '@akylas/nativescript-app-utils';
import { lc } from '@nativescript-community/l';
import { MDCAlertControlerOptions, alert, confirm } from '@nativescript-community/ui-material-dialogs';
import { HorizontalPosition, PopoverOptions, VerticalPosition } from '@nativescript-community/ui-popover';
import { closePopover, showPopover } from '@nativescript-community/ui-popover/svelte';
import { AlertOptions, GridLayout, View } from '@nativescript/core';
import { SDK_VERSION, copyToClipboard, debounce } from '@nativescript/core/utils';
import { tryCatchFunction } from '@shared/utils/ui';
import { showError } from '@shared/utils/showError';
import { navigate } from '@shared/utils/svelte/ui';
import { hideLoading, showSnack, showToast } from '@shared/utils/ui';
import { ComponentProps } from 'svelte';
import { ComponentInstanceInfo, resolveComponentElement } from 'svelte-native/dom';
import { get } from 'svelte/store';
import type OptionSelect__SvelteComponent_ from '~/components/common/OptionSelect.svelte';
import { Group } from '~/models/Item';
import { colors, fontScale, screenWidthDips } from '~/variables';

export * from '@shared/utils/ui';

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

export async function showAlertOptionSelect<T>(props?: ComponentProps<OptionSelect__SvelteComponent_>, options?: Partial<AlertOptions & MDCAlertControlerOptions>) {
    const component = (await import('~/components/common/OptionSelect.svelte')).default;
    let componentInstanceInfo: ComponentInstanceInfo<GridLayout, OptionSelect__SvelteComponent_>;
    try {
        componentInstanceInfo = resolveComponentElement(component, {
            onClose: (result) => {
                view.bindingContext.closeCallback(result);
            },
            onCheckBox(item, value, e) {
                view.bindingContext.closeCallback(item);
            },
            trackingScrollView: 'collectionView',
            ...props
        }) as ComponentInstanceInfo<GridLayout, OptionSelect__SvelteComponent_>;
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

export async function showPopoverMenu<T = any>({
    anchor,
    closeOnClose = true,
    horizPos,
    onClose,
    onLongPress,
    options,
    props,
    vertPos
}: { options; anchor; onClose?; onLongPress?; props?; closeOnClose? } & Partial<PopoverOptions>) {
    const { colorSurfaceContainer } = get(colors);
    const OptionSelect = (await import('~/components/common/OptionSelect.svelte')).default;
    const rowHeight = (props?.rowHeight || 60) * get(fontScale);
    const result: T = await showPopover({
        backgroundColor: colorSurfaceContainer,
        view: OptionSelect,
        anchor,
        horizPos: horizPos ?? HorizontalPosition.ALIGN_LEFT,
        vertPos: vertPos ?? VerticalPosition.CENTER,
        props: {
            borderRadius: 10,
            elevation: __ANDROID__ ? 3 : 0,
            margin: 4,
            fontWeight: 500,
            backgroundColor: colorSurfaceContainer,
            containerColumns: 'auto',
            rowHeight: !!props?.autoSizeListItem ? null : rowHeight,
            height: Math.min(rowHeight * options.length, props?.maxHeight ?? 300),
            width: 200 * get(fontScale),
            options,
            onLongPress,
            onClose: tryCatchFunction(
                async (item) => {
                    if (closeOnClose) {
                        if (__IOS__) {
                            // on iOS we need to wait or if onClose shows an alert dialog it wont work
                            await closePopover();
                        } else {
                            closePopover();
                        }
                    }
                    return onClose?.(item);
                },
                undefined,
                hideLoading
            ),
            ...(props || {})
        }
    });
    return result;
}

export function createView<T extends View>(claz: new () => T, props: Partial<Pick<T, keyof T>> = {}, events?) {
    const view: T = new claz();
    Object.assign(view, props);
    if (events) {
        Object.keys(events).forEach((k) => view.on(k, events[k]));
    }
    return view;
}
export async function showSliderPopover({
    anchor,
    debounceDuration = 100,
    formatter,
    horizPos = HorizontalPosition.ALIGN_LEFT,
    icon,
    max = 100,
    min = 0,
    onChange,
    step = 1,
    title,
    value,
    valueFormatter,
    vertPos = VerticalPosition.CENTER,
    width = 0.8 * screenWidthDips
}: {
    title?;
    debounceDuration?;
    icon?;
    min?;
    max?;
    step?;
    formatter?;
    valueFormatter?;
    horizPos?;
    anchor;
    vertPos?;
    width?;
    value?;
    onChange?;
}) {
    const component = (await import('~/components/common/SliderPopover.svelte')).default;
    const { colorSurfaceContainer } = get(colors);

    return showPopover({
        backgroundColor: colorSurfaceContainer,
        view: component,
        anchor,
        horizPos,
        vertPos,
        props: {
            title,
            icon,
            min,
            max,
            step,
            width,
            formatter,
            valueFormatter,
            value,
            onChange: debounceDuration ? debounce(onChange, debounceDuration) : onChange
        }

        // trackingScrollView: 'collectionView'
    });
}

export async function showSlidersPopover({
    anchor,
    debounceDuration = 100,
    horizPos = HorizontalPosition.ALIGN_LEFT,
    items,
    vertPos = VerticalPosition.CENTER,
    width = 0.8 * screenWidthDips
}: {
    debounceDuration?;
    horizPos?;
    anchor;
    vertPos?;
    width?;
    items;
}) {
    const component = (await import('~/components/common/SlidersPopover.svelte')).default;
    const { colorSurfaceContainer } = get(colors);

    return showPopover({
        backgroundColor: colorSurfaceContainer,
        view: component,
        anchor,
        horizPos,
        vertPos,
        props: {
            width,
            items
        }

        // trackingScrollView: 'collectionView'
    });
}

export async function showSettings(props?) {
    const Settings = (await import('~/components/settings/Settings.svelte')).default;
    navigate({
        page: Settings,
        props
    });
}

let confirmingRestart = false;
export async function confirmRestartApp() {
    if (confirmingRestart) {
        return;
    }
    try {
        confirmingRestart = true;
        if (__ANDROID__) {
            DEV_LOG && console.log('confirm restart');
            const result = await confirm({
                message: lc('restart_app'),
                okButtonText: lc('restart'),
                cancelButtonText: lc('later')
            });
            if (result) {
                restartApp();
            }
        } else {
            await showSnack({ message: lc('please_restart_app') });
        }
    } finally {
        confirmingRestart = false;
    }
}

export function copyTextToClipboard(text) {
    copyToClipboard(text);
    showToast(lc('copied_to_clipboard', text));
}
