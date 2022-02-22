import { setActivityCallbacks } from '@akylas/nativescript/ui/frame';
import { AndroidActivityCallbacks, Application } from '@nativescript/core';
import { sdkVersion } from '~/utils/utils';


@JavaProxy('akylas.alpi.maps.MainActivity')
@NativeClass
export default class AppActivity extends androidx.appcompat.app.AppCompatActivity {
    isNativeScriptActivity: boolean;
    private _callbacks: AndroidActivityCallbacks;
    constructor() {
        super();
        return global.__native(this);
    }

    public enableShowWhenLockedAndTurnScreenOn() {
        if (sdkVersion() >= 27) {
            this.setShowWhenLocked(true);
            // this.setTurnScreenOn(true);
        } else {
            this.getWindow().addFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                // || android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
    }
    public disableShowWhenLockedAndTurnScreenOn() {
        if (sdkVersion() >= 27) {
            this.setShowWhenLocked(false);
            // this.setTurnScreenOn(false);
        } else {
            this.getWindow().clearFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                // || android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
    }
    public onCreate(savedInstanceState: android.os.Bundle): void {
        Application.android.init(this.getApplication());
        this.isNativeScriptActivity = true;
        if (!this._callbacks) {
            setActivityCallbacks(this);
        }
        this._callbacks.onCreate(this, savedInstanceState, this.getIntent(), super.onCreate);
    }

    public onNewIntent(intent: android.content.Intent): void {
        this._callbacks.onNewIntent(this, intent, super.setIntent, super.onNewIntent);
    }

    public onSaveInstanceState(outState: android.os.Bundle): void {
        this._callbacks.onSaveInstanceState(this, outState, super.onSaveInstanceState);
    }

    public onStart(): void {
        this._callbacks.onStart(this, super.onStart);
    }

    public onStop(): void {
        this._callbacks.onStop(this, super.onStop);
    }

    public onDestroy(): void {
        this._callbacks.onDestroy(this, super.onDestroy);
    }

    public onPostResume(): void {
        this._callbacks.onPostResume(this, super.onPostResume);
    }

    public onBackPressed(): void {
        this._callbacks.onBackPressed(this, super.onBackPressed);
    }

    public onRequestPermissionsResult(requestCode: number, permissions: string[], grantResults: number[]): void {
        this._callbacks.onRequestPermissionsResult(this, requestCode, permissions, grantResults, undefined /*TODO: Enable if needed*/);
    }

    public onActivityResult(requestCode: number, resultCode: number, data: android.content.Intent): void {
        this._callbacks.onActivityResult(this, requestCode, resultCode, data, super.onActivityResult);
    }
}
