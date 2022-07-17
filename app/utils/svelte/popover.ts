import { GestureRootView } from '@nativescript-community/gesturehandler';
import { View } from '@nativescript/core';
import { NativeViewElementNode, createElement } from 'svelte-native/dom';
// import { DocumentNode } from 'svelte-native/dom/basicdom';
import type { PopoverOptions } from '@nativescript-community/ui-popover';
// eslint-disable-next-line no-duplicate-imports
import { showPopover as showPopupWindow } from '@nativescript-community/ui-popover';

type ViewSpec = typeof SvelteComponent;
export interface PopoverSvelteOptions extends Omit<PopoverOptions, 'anchor'> {
    view: ViewSpec;
    anchor?: NativeViewElementNode<View> | View;
    props?: any;
}
interface ComponentInstanceInfo {
    element: NativeViewElementNode<View>;
    viewInstance: SvelteComponent;
}

const modalStack: any[] = [];

export function resolveComponentElement(viewSpec: ViewSpec, props?: any): ComponentInstanceInfo {
    const dummy = createElement('fragment', window.document as any);
    const viewInstance = new viewSpec({ target: dummy, props });
    const element = dummy.firstElement() as NativeViewElementNode<View>;
    return { element, viewInstance };
}

export function showPopover(modalOptions: PopoverSvelteOptions) {
    const { view, anchor, props = {}, ...options } = modalOptions;
    // Get this before any potential new frames are created by component below
    const anchorView: View = anchor instanceof View ? anchor : anchor.nativeView;

    const componentInstanceInfo = resolveComponentElement(view, props);
    let modalView: View = componentInstanceInfo.element.nativeView;
    if (!(modalView instanceof GestureRootView)) {
        const gestureView = new GestureRootView();
        gestureView.height = modalView.height;
        gestureView.addChild(modalView);
        modalView = gestureView;
    }

    return new Promise<void>(async (resolve, reject) => {
        let resolved = false;
        const closeCallback = () => {
            if (resolved) return;
            modalStack.pop();
            resolved = true;
            resolve();
            componentInstanceInfo.viewInstance.$destroy(); // don't let an exception in destroy kill the promise callback
        };
        try {
            modalStack.push(showPopupWindow(modalView, { ...options, anchor: anchorView, onDismiss: closeCallback }));
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}

export function closePopover(result?: any): void {
    const modalPageInstanceInfo = modalStack.at(-1);
    if (modalPageInstanceInfo) {
        modalPageInstanceInfo.dismiss();
    }
}
export function isPopoverOpened() {
    return modalStack.length > 0;
}
