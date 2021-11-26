import { InAppBrowser } from '@akylas/nativescript-inappbrowser';
import { primaryColor } from '~/variables';
import { openUrl } from '@nativescript/core/utils/utils';

export async function openLink(url) {
    try {
        const available = await InAppBrowser.isAvailable();
        console.log('openLink', url, available);
        if (available) {
            const result = await InAppBrowser.open(url, {
                // iOS Properties
                dismissButtonStyle: 'close',
                preferredBarTintColor: primaryColor,
                preferredControlTintColor: 'white',
                readerMode: false,
                animated: true,
                enableBarCollapsing: false,
                // Android Properties
                showTitle: true,
                toolbarColor: primaryColor,
                secondaryToolbarColor: 'white',
                enableUrlBarHiding: true,
                enableDefaultShare: true,
                forceCloseOnRedirection: false
            });
            console.log('result', result);
            return result;
        } else {
            openUrl(url);
        }
    } catch (error) {
        alert({
            title: 'Error',
            message: error.message,
            okButtonText: 'Ok'
        });
    }
}
