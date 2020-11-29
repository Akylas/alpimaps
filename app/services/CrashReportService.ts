import { Observable } from '@nativescript/core/data/observable';
import { booleanProperty } from './BackendService';
import * as Sentry from '@nativescript-community/sentry';
import { getBuildNumber, getVersionName } from '@nativescript-community/extendedinfo';
import { Device } from '@nativescript/core/platform';
import { alert, confirm } from '@nativescript-community/ui-material-dialogs';
import { Label as HTMLLabel } from '@nativescript-community/ui-label';
import { Color } from '@nativescript/core/color';
import { BaseError } from 'make-error';
import { install } from '~/utils/logging';
import { l, lc } from '@nativescript-community/l';

function evalTemplateString(resource: string, obj: {}) {
    if (!obj) {
        return resource;
    }
    const names = Object.keys(obj);
    const vals = Object.keys(obj).map((key) => obj[key]);
    return new Function(...names, `return \`${resource}\`;`)(...vals);
}

export class CustomError extends BaseError {
    customErrorConstructorName: string;
    isCustomError = true;
    assignedLocalData: any;
    silent?: boolean;
    constructor(props?, customErrorConstructorName?: string) {
        super(props.message);
        this.message = props.message;
        delete props.message;

        this.silent = props.silent;
        delete props.silent;

        // we need to understand if we are duplicating or not
        const isError = props instanceof Error;
        if (customErrorConstructorName || isError) {
            // duplicating
            // use getOwnPropertyNames to get hidden Error props
            const keys = Object.getOwnPropertyNames(props);
            for (let index = 0; index < keys.length; index++) {
                const k = keys[index];
                if (!props[k] || typeof props[k] === 'function') continue;
                this[k] = props[k];
            }
        }
        this.assignedLocalData = props;

        if (!this.customErrorConstructorName) {
            this.customErrorConstructorName = customErrorConstructorName || (this as any).constructor.name; // OR (<any>this).constructor.name;
        }
    }

    localData() {
        const res = {};
        for (const key in this.assignedLocalData) {
            res[key] = this.assignedLocalData[key];
        }
        return res;
    }

    toJSON() {
        const error = {
            message: this.message,
        };
        Object.getOwnPropertyNames(this).forEach((key) => {
            if (typeof this[key] !== 'function') {
                error[key] = this[key];
            }
        });
        return error;
    }
    toData() {
        return JSON.stringify(this.toJSON());
    }
    toString() {
        return evalTemplateString(l(this.message), Object.assign({ localize: l }, this.assignedLocalData));
    }

    getMessage() {}
}
export class TimeoutError extends CustomError {
    constructor(props?) {
        super(
            Object.assign(
                {
                    message: 'timeout_error',
                },
                props
            ),
            'TimeoutError'
        );
    }
}

export class NoNetworkError extends CustomError {
    constructor(props?) {
        super(
            Object.assign(
                {
                    message: 'no_network',
                },
                props
            ),
            'NoNetworkError'
        );
    }
}
// export interface HTTPErrorProps {
//     statusCode: number;
//     responseHeaders?: Headers;
//     title?: string;
//     message: string;
//     requestParams: HTTPOptions;
// }
// export class HTTPError extends CustomError {
//     statusCode: number;
//     responseHeaders?: Headers;
//     requestParams: HTTPOptions;
//     constructor(props: HTTPErrorProps | HTTPError) {
//         super(
//             Object.assign(
//                 {
//                     message: 'httpError'
//                 },
//                 props
//             ),
//             'HTTPError'
//         );
//     }
// }
export class MessageError extends CustomError {
    constructor(props: { title?: string; message: string }) {
        super(
            Object.assign(
                {
                    message: 'error',
                },
                props
            ),
            'MessageError'
        );
    }
}

export default class CrashReportService extends Observable {
    @booleanProperty({ default: true }) sentryEnabled: boolean;
    sentry: typeof Sentry;
    async start() {
        install();
        if (gVars.sentry && this.sentryEnabled) {
            const Sentry = await import('@nativescript-community/sentry');
            this.sentry = Sentry;
            const versionName = await getVersionName();
            const buildNumber = await getBuildNumber();
            Sentry.init({
                dsn: SENTRY_DSN,
                appPrefix: SENTRY_PREFIX,
                release: `${versionName}`,
                dist: `${buildNumber}.${global.isAndroid ? 'android' : 'ios'}`,
            });
            Sentry.setTag('locale', Device.language);
            // });
        } else {
            this.sentry = null;
        }
    }
    async enable() {
        this.sentryEnabled = true;
        if (!this.sentry) {
            await this.start();
        }
    }
    async disable() {
        this.sentryEnabled = false;
    }

    captureException(err: Error | CustomError) {
        if (this.sentryEnabled && this.sentry) {
            if (err instanceof CustomError) {
                this.withScope((scope) => {
                    scope.setExtra('errorData', JSON.stringify(err.assignedLocalData));
                    this.sentry.captureException(err);
                });
            } else {
                return this.sentry.captureException(err);
            }
        }
    }
    captureMessage(message: string, level?: Sentry.Severity) {
        if (this.sentryEnabled && this.sentry) {
            return this.sentry.captureMessage(message, level);
        }
    }
    setExtra(key: string, value: any) {
        if (this.sentryEnabled && this.sentry) {
            return this.sentry.setExtra(key, value);
        }
    }
    withScope(callback: (scope: Sentry.Scope) => void) {
        if (this.sentryEnabled && this.sentry) {
            return this.sentry.withScope(callback);
        }
    }

    showError(err: Error | string) {
        const realError = typeof err === 'string' ? null : err;
        const isString = realError === null;
        const message = isString ? (err as string) : realError.message || realError.toString();
        const title = lc('error');
        const reporterEnabled = this.sentryEnabled;
        let showSendBugReport = reporterEnabled && !isString && !!realError.stack;
        // if (realError instanceof HTTPError) {
        //     title = `${title} (${realError.statusCode})`;
        // } else
        if (realError instanceof NoNetworkError || realError instanceof MessageError) {
            showSendBugReport = false;
        }
        console.log('showError', err, err['stack']);
        const label = new HTMLLabel();
        label.style.padding = '10 20 0 26';
        // label.style.backgroundColor = new Color(255, 255,0,0);
        label.style.fontSize = 16;
        label.style.color = new Color(255, 138, 138, 138);
        label.html = lc(message.trim());
        return confirm({
            title,
            view: label,
            okButtonText: showSendBugReport ? lc('send_bug_report') : undefined,
            cancelButtonText: showSendBugReport ? lc('cancel') : lc('ok'),
        }).then((result) => {
            if (result && showSendBugReport) {
                this.captureException(realError);
                alert(l('bug_report_sent'));
            }
        });
    }
}
