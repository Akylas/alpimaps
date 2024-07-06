import { capitalize, l, lc, loadLocaleJSON, lt, lu, overrideNativeLocale, titlecase } from '@nativescript-community/l';
import { Application, ApplicationSettings, Device, EventData, File, Utils } from '@nativescript/core';
import { getString } from '@nativescript/core/application-settings';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import localizedFormat from 'dayjs/plugin/localizedFormat';
// import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
// import updateLocale from 'dayjs/plugin/updateLocale';
import utc from 'dayjs/plugin/utc';

import { derived, get, writable } from 'svelte/store';
import { prefs } from '~/services/preferences';
import { showError } from '~/utils/error';
import { showAlertOptionSelect } from '~/utils/ui';
import { createGlobalEventListener, globalObservable } from '~/utils/svelte/ui';
const supportedLanguages = SUPPORTED_LOCALES;

// dayjs.extend(updateLocale);
// dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.extend(utc);

export let lang;
export const langStore = writable(null);
let default24Clock = false;
if (__ANDROID__) {
    default24Clock = android.text.format.DateFormat.is24HourFormat(Utils.android.getApplicationContext());
}
export let clock_24 = ApplicationSettings.getBoolean('clock_24', default24Clock) || default24Clock;
export const clock_24Store = writable(null);

export const onLanguageChanged = createGlobalEventListener<string, EventData & { clock_24: boolean }>('language');
export const onMapLanguageChanged = createGlobalEventListener<string>('map_language');
// export const onTimeChanged = createGlobalEventListener('time');

async function loadDayjsLang(newLang: string) {
    const toLoad = newLang.replace('_', '-');
    try {
        await import(`dayjs/locale/${toLoad}.js`);
        dayjs.locale(toLoad);
        DEV_LOG && console.log('dayjs loaded', toLoad, dayjs().format('llll'));
    } catch (err) {
        if (toLoad.indexOf('-') !== -1) {
            loadDayjsLang(toLoad.split('-')[0]);
        } else {
            DEV_LOG && console.error(lang, `~/dayjs/${toLoad}`, err, err.stack);
        }
    }
}

langStore.subscribe((newLang: string) => {
    lang = newLang;
    if (!lang) {
        return;
    }
    DEV_LOG && console.log('changed lang', lang, Device.region);
    loadDayjsLang(lang);
    try {
        // const localeData = require(`~/i18n/${lang}.json`);
        loadLocaleJSON(`~/i18n/${lang}.json`, '~/i18n/en.json');
    } catch (err) {
        console.error(lang, `~/i18n/${lang}.json`, File.exists(`~/i18n/${lang}.json`), err, err.stack);
    }
    globalObservable.notify({ eventName: 'language', data: lang });
});
function setLang(newLang) {
    let actualNewLang = getActualLanguage(newLang);
    DEV_LOG && console.log('setLang', newLang, actualNewLang);
    if (__IOS__) {
        overrideNativeLocale(actualNewLang);
        currentLocale = null;
    } else {
        // Application.android.foregroundActivity?.recreate();
        try {
            let appLocale: androidx.core.os.LocaleListCompat;
            if (newLang === 'auto') {
                appLocale = androidx.core.os.LocaleListCompat.getEmptyLocaleList();
            } else {
                const langs = [...new Set([actualNewLang, actualNewLang.split('_')[0]])].join(',');
                DEV_LOG && console.log('forLanguageTags', langs);
                appLocale = androidx.core.os.LocaleListCompat.forLanguageTags(langs);
                const strLangTags = appLocale
                    .toLanguageTags()
                    .split(',')
                    .filter((s) => s !== 'und');
                if (strLangTags.length !== appLocale.size()) {
                    appLocale = androidx.core.os.LocaleListCompat.forLanguageTags(strLangTags.join(','));
                }
            }
            DEV_LOG && console.log('appLocale', appLocale.toLanguageTags(), actualNewLang);
            // Call this on the main thread as it may require Activity.restart()
            androidx.appcompat.app.AppCompatDelegate['setApplicationLocales'](appLocale);
            currentLocale = null;
            // TODO: check why getEmptyLocaleList does not reset the locale to system
            actualNewLang = getActualLanguage(newLang);
        } catch (error) {
            console.error(error);
        }
    }
    langStore.set(actualNewLang);
}

const deviceLanguage = getString('language', DEFAULT_LOCALE);
function getActualLanguage(language) {
    if (language === 'auto') {
        if (__ANDROID__) {
            // N Device.language reads app config which thus does return locale app language and not device language
            language = java.util.Locale.getDefault().getLanguage();
        } else {
            language = Device.language;
        }
    }
    switch (language) {
        case 'cs':
            language = 'cz';
            break;
        case 'jp':
            language = 'ja';
            break;
        case 'lv':
            language = 'la';
            break;
    }

    if (supportedLanguages.indexOf(language) === -1) {
        language = language.split('-')[0].toLowerCase();
        if (supportedLanguages.indexOf(language) === -1) {
            language = 'en';
        }
    }
    return language;
}

export function getLocalTime(timestamp?: number | string | dayjs.Dayjs | Date, timezoneOffset?: number) {
    return timezoneOffset !== undefined ? dayjs.utc(timestamp).utcOffset(timezoneOffset) : dayjs(timestamp);
}

export function formatDate(date: number | string | dayjs.Dayjs, formatStr: string = 'dddd LT', timezoneOffset?: number) {
    if (date) {
        if (!date['format']) {
            date = getLocalTime(date, timezoneOffset);
        }

        if (clock_24 && formatStr.indexOf('LT') >= 0) {
            formatStr.replace(/LT/g, 'HH:mm');
        } else if (clock_24 && formatStr.indexOf('LTS') >= 0) {
            // formatStr = 'HH:mm:ss';
            formatStr.replace(/LTS/g, 'HH:mm:ss');
        }
        return capitalize((date as dayjs.Dayjs).format(formatStr));
    }
    return '';
}
export function formatTime(date: number | dayjs.Dayjs | string | Date, formatStr: string = 'LT', timezoneOffset?: number) {
    if (date) {
        if (!date['format']) {
            date = getLocalTime(date, timezoneOffset);
        }
        if (clock_24 && formatStr === 'LT') {
            formatStr = 'HH:mm';
        } else if (clock_24 && formatStr === 'LTS') {
            formatStr = 'HH:mm:ss';
        }
        return (date as dayjs.Dayjs).format(formatStr);
    }
    return '';
}

prefs.on('key:language', () => {
    const newLanguage = getString('language');
    DEV_LOG && console.log('language changed', newLanguage);
    // on pref change we are updating
    if (newLanguage === lang) {
        return;
    }
    setLang(newLanguage);
});

prefs.on('key:clock_24', () => {
    const newValue = ApplicationSettings.getBoolean('clock_24', default24Clock);
    // DEV_LOG && console.log('clock_24 changed', newValue);
    clock_24 = newValue;
    clock_24Store.set(newValue);
    // we fake a language change to update the UI
    globalObservable.notify({ eventName: 'language', data: lang, clock_24: true });
});

let currentLocale = null;
export function getLocaleDisplayName(locale?) {
    if (__IOS__) {
        if (!currentLocale) {
            currentLocale = NSLocale.alloc().initWithLocaleIdentifier(lang);
        }
        const localeStr = currentLocale.localizedStringForLanguageCode(locale || lang);
        return localeStr ? capitalize(localeStr) : locale || lang;
    } else {
        if (!currentLocale) {
            currentLocale = java.util.Locale.forLanguageTag(lang);
        }
        return capitalize(java.util.Locale.forLanguageTag(locale || lang).getDisplayLanguage(currentLocale));
    }
}
export function getCurrentISO3Language() {
    if (__IOS__) {
        return NSLocale.alloc().initWithLocaleIdentifier(lang)['ISO639_2LanguageCode']();
    } else {
        const locale = java.util.Locale.forLanguageTag(lang);
        return locale.getISO3Language();
    }
}
async function internalSelectLanguage() {
    // try {
    const actions = SUPPORTED_LOCALES;
    const currentLanguage = getString('language', DEFAULT_LOCALE);
    const component = (await import('~/components/common/OptionSelect.svelte')).default;
    return showAlertOptionSelect(
        component,
        {
            height: Math.min(actions.length * 56, 400),
            rowHeight: 56,
            options: [{ name: lc('auto'), data: 'auto' }].concat(actions.map((k) => ({ name: getLocaleDisplayName(k.replace('_', '-')), data: k }))).map((d) => ({
                ...d,
                boxType: 'circle',
                type: 'checkbox',
                value: currentLanguage === d.data
            }))
        },
        {
            title: lc('select_language')
        }
    );
}
export async function selectLanguage() {
    try {
        const result = await internalSelectLanguage();
        DEV_LOG && console.log('selectLanguage', result);
        if (result?.data) {
            ApplicationSettings.setString('language', result.data);
        }
    } catch (err) {
        showError(err);
    }
}
export async function selectMapLanguage() {
    try {
        const result = await internalSelectLanguage();
        if (result && result.data) {
            if (result.data === 'auto') {
                ApplicationSettings.remove('map_language');
                globalObservable.notify({ eventName: 'map_language', data: lang });
            } else {
                ApplicationSettings.setString('map_language', result.data);
                globalObservable.notify({ eventName: 'map_language', data: result.data });
            }
        }
    } catch (err) {
        showError(err);
    }
}

export function convertDurationSeconds(seconds, formatStr?: string) {
    const thedate = new Date(0, 0, 0, 0, 0, seconds);
    if (!formatStr) {
        if (thedate.getHours()) {
            formatStr = 'H [h] m [m]';
        } else {
            formatStr = 'm [m]';
        }
    }
    return dayjs(thedate).format(formatStr);
}

// TODO: on android 13 check for per app language, we dont need to store it
setLang(deviceLanguage);

Application.on('activity_started', () => {
    // on android after switching to auto we dont get the actual language
    // before an activity restart
    if (__ANDROID__) {
        const lang = ApplicationSettings.getString('language');
        if (lang === 'auto') {
            const actualNewLang = getActualLanguage(lang);
            if (actualNewLang !== get(langStore)) {
                langStore.set(actualNewLang);
            }
        }
    }
});

export { l, lc, lt, lu };
export const sl = derived([langStore], () => l);
export const slc = derived([langStore], () => lc);
export const slt = derived([langStore], () => lt);
export const slu = derived([langStore], () => lu);
// export const sconvertDuration = derived([langStore], () => convertDuration);
export const scformatDate = derived(langStore, () => formatDate);
export const scformatTime = derived([langStore, clock_24Store], () => formatTime);
export const sgetLocaleDisplayName = derived([langStore], () => getLocaleDisplayName);
