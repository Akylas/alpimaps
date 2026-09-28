import { Application, Utils } from '@nativescript/core';
import type { ScreenOrientation } from '~/utils/orientation';

// Both needed (iOS 16+): a scene geometry request AND the root controller's changed
// `supportedInterfaceOrientations`, else the request is refused. Below 16 this reports failure:
// the `setValueForKey('orientation')` trick is private API and gets builds rejected.

/** What is currently being asked for, so the root controller's override answers consistently. */
let preferredMask: UIInterfaceOrientationMask = null;

function rootController(): UIViewController {
    return Application.ios?.rootController;
}

// per-instance `defineProperty`: the property is read-only on the class, and the root controller is
// built by NativeScript, so it cannot be subclassed
function applySupportedOrientations() {
    const controller = rootController();
    if (!controller) {
        return;
    }
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
    // connectedScenes is a SET; a one-window app has exactly one member
    const scene = UIApplication.sharedApplication.connectedScenes?.anyObject();
    if (!scene?.requestGeometryUpdateWithPreferencesErrorHandler) {
        return false;
    }
    const preferences = UIWindowSceneGeometryPreferencesIOS.alloc().initWithInterfaceOrientations(mask);
    scene.requestGeometryUpdateWithPreferencesErrorHandler(preferences, (error) => {
        // Reported, not thrown: a refused rotation leaves the mode usable, just the wrong way up.
        DEV_LOG && console.log('requestGeometryUpdate refused', error?.localizedDescription);
    });
    return true;
}

export function lockOrientation(orientation: ScreenOrientation): boolean {
    if (orientation === 'auto' || orientation === 'sensor') {
        if (preferredMask === null) {
            return true;
        }
        preferredMask = null;
        applySupportedOrientations();
        // Nothing is requested on the way out: dropping the restriction lets the system rotate back on
        // its own, which also respects the user's rotation lock — asking for one would not.
        return true;
    }
    if (Utils.ios.MajorVersion < 16) {
        return false;
    }
    // Landscape, not LandscapeLeft: which way round the phone is held is the user's business.
    preferredMask = orientation === 'portrait' ? UIInterfaceOrientationMask.Portrait : UIInterfaceOrientationMask.Landscape;
    applySupportedOrientations();
    return requestGeometry(preferredMask);
}
