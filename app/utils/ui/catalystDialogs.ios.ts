import { showingDialogs } from '@nativescript-community/ui-material-dialogs/dialogs-common';

// On Mac Catalyst, once a recognizer in the window has taken over a mouse drag (the map's), UIKit stops handing that
// mouse's touch to plain views. An alert's buttons are UIControls: they never fire, while the scrim's tap recognizer
// still does, so only a click outside works. A tap recognizer on each button presses it instead. It cancels the
// button's own touches, so the press is never sent twice.
@NativeClass
class AlertButtonTapRecognizer extends UITapGestureRecognizer {
    public button: UIControl;

    public static ObjCExposedMethods = {
        onTap: { returns: interop.types.void, params: [interop.types.id] }
    };

    public static initWithButton(button: UIControl): AlertButtonTapRecognizer {
        const recognizer = AlertButtonTapRecognizer.new() as AlertButtonTapRecognizer;
        recognizer.button = button;
        // weak target: the recognizer itself, which the button keeps alive
        recognizer.addTargetAction(recognizer, 'onTap');
        return recognizer;
    }

    public onTap() {
        this.button?.sendActionsForControlEvents(UIControlEvents.TouchUpInside);
    }
}

function addTapRecognizers(alertController) {
    const actions = alertController.actions;
    for (let index = 0; index < actions.count; index++) {
        const button: UIControl = alertController.buttonForAction(actions.objectAtIndex(index));
        if (button) {
            button.addGestureRecognizer(AlertButtonTapRecognizer.initWithButton(button));
        }
    }
}

/** Makes the buttons of every material alert, confirm and prompt clickable on Mac Catalyst. */
export function installCatalystDialogButtons() {
    const push = showingDialogs.push.bind(showingDialogs);
    showingDialogs.push = (...alertControllers) => {
        // once presented: the buttons are the ones on screen
        setTimeout(() => {
            try {
                alertControllers.forEach(addTapRecognizers);
            } catch (error) {
                console.error('catalystDialogs', error);
            }
        });
        return push(...alertControllers);
    };
}
