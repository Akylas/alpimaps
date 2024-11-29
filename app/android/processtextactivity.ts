import { Utils } from '@nativescript/core';

@NativeClass
@JavaProxy('__PACKAGE__.ProcessTextActivity')
export class ProcessTextActivity extends androidx.appcompat.app.AppCompatActivity {
    constructor() {
        super();
        return global.__native(this);
    }
    public onCreate(savedInstanceState: android.os.Bundle): void {
        super.onCreate(savedInstanceState);
        // const intent = this.getIntent();
        const context = Utils.android.getApplicationContext();
        const intent = this.getIntent() || context.getPackageManager().getLaunchIntentForPackage(__APP_ID__);

        if (intent) {
            const data = this.getIntent().getStringExtra('android.intent.extra.TEXT') || this.getIntent().getStringExtra('android.intent.extra.PROCESS_TEXT');
            const newIntent = context.getPackageManager().getLaunchIntentForPackage(__APP_ID__);
            newIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            newIntent.setData(android.net.Uri.parse(data));
            context.startActivity(newIntent);
            DEV_LOG && console.log('ProcessTextActivity', 'onCreate', intent.getAction(), data);
            // return true;
        }
        // globalObservable.notify({ eventName: 'onOtherAppTextSelected', data: intent.getStringExtra('android.intent.extra.PROCESS_TEXT') });

        this.finish();
    }

    public onNewIntent(intent: android.content.Intent): void {
        DEV_LOG && console.log('ProcessTextActivity', 'onNewIntent', intent.getAction(), intent.getStringExtra('android.intent.extra.PROCESS_TEXT'));
    }
}
