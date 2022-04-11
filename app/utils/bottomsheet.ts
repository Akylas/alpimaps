import { GestureRootView } from '@nativescript-community/gesturehandler';
import { BottomSheetOptions } from '@nativescript-community/ui-material-bottomsheet';
import { View } from '@nativescript/core';
import { View as View2 } from '@nativescript/core/ui/core/view';
import { Frame } from '@nativescript/core/ui/frame';
import { NativeViewElementNode, createElement } from 'svelte-native/dom';
import { DocumentNode } from 'svelte-native/dom/basicdom';
import { PageSpec } from 'svelte-native/dom/navigation';

export interface ShowBottomSheetOptions extends Omit<BottomSheetOptions, 'view'> {
    view: PageSpec;
    parent?: NativeViewElementNode<View> | View;
    props?: any;
}
interface ComponentInstanceInfo {
    element: NativeViewElementNode<View>;
    viewInstance: SvelteComponent;
}

const modalStack: ComponentInstanceInfo[] = [];

export function resolveComponentElement(viewSpec: PageSpec, props?: any): ComponentInstanceInfo {
    const dummy = createElement('fragment', window.document as unknown as DocumentNode);
    const viewInstance = new viewSpec({ target: dummy, props });
    const element = dummy.firstElement() as NativeViewElementNode<View>;
    return { element, viewInstance };
}

export function showBottomSheet<T>(modalOptions: ShowBottomSheetOptions): Promise<T> {
    const { view, parent, props = {}, ...options } = modalOptions;
    // Get this before any potential new frames are created by component below
    const modalLauncher: View2 = (parent && (parent instanceof View ? parent : parent.nativeView)) || (Frame.topmost().currentPage as any);

    const componentInstanceInfo = resolveComponentElement(view, props);
    let modalView: View = componentInstanceInfo.element.nativeView;
    if (!(modalView instanceof GestureRootView)) {
        const gestureView = new GestureRootView();
        gestureView.height = modalView.height;
        gestureView.addChild(modalView);
        modalView = gestureView;
    }

    return new Promise(async (resolve, reject) => {
        let resolved = false;
        const closeCallback = (result: T) => {
            if (resolved) return;
            modalStack.pop();
            resolved = true;
            resolve(result);
            modalView._tearDownUI();
            componentInstanceInfo.viewInstance.$destroy(); // don't let an exception in destroy kill the promise callback
        };
        try {
            modalLauncher.showBottomSheet({ view: modalView, ...options, context: {}, closeCallback });
            modalStack.push(componentInstanceInfo);
        } catch (err) {
            reject(err);
        }
    });
}

export function closeBottomSheet(result?: any): void {
    const modalPageInstanceInfo = modalStack.at(-1);
    if (modalPageInstanceInfo) {
        (modalPageInstanceInfo.element.nativeView as any).closeBottomSheet(result);
    }
}
export function isBottomSheetOpened() {
    return modalStack.length > 0;
}
