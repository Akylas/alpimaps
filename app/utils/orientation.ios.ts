import { Application, Utils } from '@nativescript/core';

/**
 * iOS does not let an app set an orientation; it lets it state a PREFERENCE and then asks the view
 * controller whether that is allowed. So there are two halves here, and both are needed:
 *
 *  - the window scene is asked for a new geometry (iOS 16+, `requestGeometryUpdate`), and
 *  - the root view controller is told its answer to `supportedInterfaceOrientations` has changed,
 *    or the system asks the old one and refuses the request.
 *
 * `App_Resources/iOS/Info.plist` lists both landscape orientations, so the request is one the system
 * can grant. Below iOS 16 there is no supported way to do this from outside a view controller, and
 * this reports failure rather than reaching for the old `setValueForKey('orientation')` trick — that
 * one is private API and is what gets builds rejected.
 */

/** What we are currently asking for, so the root controller's override can answer consistently. */
let preferredMask: UIInterfaceOrientationMask = null;

function rootController(): UIViewController {
    return Application.ios?.rootController;
}

/**
 * Overrides `supportedInterfaceOrientations` on the LIVE controller object.
 *
 * Not a subclass: the root controller is built by NativeScript before anything here runs, so the
 * class it was made from is not ours to change. Assigning the property on the instance is what the
 * runtime turns into a method override.
 */
function applySupportedOrientations() {
    const controller = rootController();
    if (!controller) {
        return;
    }
    // defineProperty, not an assignment: the typings mark `supportedInterfaceOrientations` read-only
    // (it IS, on the class), while overriding it on the instance is exactly how the runtime lets an app
    // answer the question. Configurable so it can be taken off again.
    if (preferredMask === null) {
        Reflect.deleteProperty(controller, 'supportedInterfaceOrientations');
    } else {
        Object.defineProperty(controller, 'supportedInterfaceOrientations', {
            value: preferredMask,
            configurable: true,
            writable: true
        });
    }
    if (Utils.ios.MajorVersion >= 16) {
        controller.setNeedsUpdateOfSupportedInterfaceOrientations();
    }
}

function requestGeometry(mask: UIInterfaceOrientationMask): boolean {
    // anyObject rather than an index: connectedScenes is a SET, and an app with one window has
    // exactly one member in it.
    const scene = UIApplication.sharedApplication.connectedScenes?.anyObject();
    if (!scene?.requestGeometryUpdateWithPreferencesErrorHandler) {
        return false;
    }
    const preferences = UIWindowSceneGeometryPreferencesIOS.alloc().initWithInterfaceOrientations(mask);
    scene.requestGeometryUpdateWithPreferencesErrorHandler(preferences, (error) => {
        // Reported, not thrown: a refused rotation leaves the mode usable, just portrait.
        DEV_LOG && console.log('requestGeometryUpdate refused', error?.localizedDescription);
    });
    return true;
}

export function lockLandscape(): boolean {
    if (Utils.ios.MajorVersion < 16) {
        return false;
    }
    // Landscape, not LandscapeLeft: which way round the phone is held is the user's business.
    preferredMask = UIInterfaceOrientationMask.Landscape;
    applySupportedOrientations();
    return requestGeometry(preferredMask);
}

export function unlockOrientation() {
    if (preferredMask === null) {
        return;
    }
    preferredMask = null;
    applySupportedOrientations();
    // Nothing is requested on the way out: dropping the restriction lets the system rotate back on
    // its own, which also respects the user's rotation lock — asking for portrait would not.
}
