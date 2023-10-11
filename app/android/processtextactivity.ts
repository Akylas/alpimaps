import {
    AndroidActivityBackPressedEventData,
    AndroidActivityCallbacks,
    AndroidActivityNewIntentEventData,
    AndroidActivityRequestPermissionsEventData,
    AndroidActivityResultEventData,
    AndroidApplication,
    Application,
    ApplicationEventData,
    Frame,
    GridLayout,
    Trace,
    Utils,
    View
} from '@nativescript/core';
import { getBGServiceInstance } from '~/services/BgService';
import { globalObservable } from '~/variables';

@NativeClass
@JavaProxy('akylas.alpi.maps.ProcessTextActivity')
export class ProcessTextActivity extends androidx.appcompat.app.AppCompatActivity {
    constructor() {
        super();
        return global.__native(this);
    }
    public onCreate(savedInstanceState: android.os.Bundle): void {
        super.onCreate(savedInstanceState);
        // const intent = this.getIntent();
        const context = Utils.android.getApplicationContext();
        const intent = context.getPackageManager().getLaunchIntentForPackage(__APP_ID__);
        if (intent) {
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.setData(android.net.Uri.parse(this.getIntent().getStringExtra('android.intent.extra.PROCESS_TEXT')));
            context.startActivity(intent);
            // return true;
        }
        // globalObservable.notify({ eventName: 'onOtherAppTextSelected', data: intent.getStringExtra('android.intent.extra.PROCESS_TEXT') });

        console.log('ProcessTextActivity', 'onCreate', intent.getAction(), intent.getStringExtra('android.intent.extra.PROCESS_TEXT'));
        this.finish();
    }

    public onNewIntent(intent: android.content.Intent): void {
        console.log('ProcessTextActivity', 'onNewIntent', intent.getAction(), intent.getStringExtra('android.intent.extra.PROCESS_TEXT'));
    }
}
