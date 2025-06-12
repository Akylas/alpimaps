import { capitalize, l, lc, loadLocaleJSON, lt, lu, overrideNativeLocale } from '@nativescript-community/l';
import { Application, ApplicationSettings, Device, EventData, File, Utils } from '@nativescript/core';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import localizedFormat from 'dayjs/plugin/localizedFormat';
// import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
// import updateLocale from 'dayjs/plugin/updateLocale';
import utc from 'dayjs/plugin/utc';

import { derived, get, writable } from 'svelte/store';
import { prefs } from '~/services/preferences';
import { ALERT_OPTION_MAX_HEIGHT, DEFAULT_LOCALE, SETTINGS_LANGUAGE } from '~/utils/constants';
import { showError } from '@shared/utils/showError';
import { createGlobalEventListener, globalObservable } from '@shared/utils/svelte/ui';
import { showAlertOptionSelect } from '~/utils/ui';

import { getISO3Language } from '@akylas/nativescript-app-utils';

const supportedLanguages = SUPPORTED_LOCALES;

// dayjs.extend(updateLocale);
// dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.extend(utc);

export let lang;
export const langStore = writable(null);
export const fullLangStore = writable(null);
let default24Clock = false;
if (__ANDROID__) {
    default24Clock = android.text.format.DateFormat.is24HourFormat(Utils.android.getApplicationContext());
}
export let clock_24 = ApplicationSettings.getBoolean('clock_24', default24Clock) || default24Clock;
export const clock_24Store = writable(null);

export const onLanguageChanged = createGlobalEventListener<string, EventData & { clock_24: boolean }>(SETTINGS_LANGUAGE);
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
        loadLocaleJSON(`~/i18n/${lang}.json`, `~/i18n/${FALLBACK_LOCALE}.json`);
    } catch (err) {
        console.error(lang, `~/i18n/${lang}.json`, File.exists(`~/i18n/${lang}.json`), err, err.stack);
    }
    globalObservable.notify({ eventName: SETTINGS_LANGUAGE, data: lang });
});

function setFullLanguageCode(currentLanguage) {
    currentLanguage = currentLanguage.replace('_', '-');
    fullLangStore.set(currentLanguage.split('-').length === 1 ? currentLanguage + '-' + currentLanguage.toUpperCase() : currentLanguage);
}
function setLang(newLang) {
    let actualNewLang;
    let trueNewLang;
    // eslint-disable-next-line prefer-const
    [actualNewLang, trueNewLang] = getActualLanguage(newLang);
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
            [actualNewLang, newLang] = getActualLanguage(newLang);
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    langStore.set(actualNewLang);
    setFullLanguageCode(trueNewLang);
}

const deviceLanguage = ApplicationSettings.getString(SETTINGS_LANGUAGE, DEFAULT_LOCALE);
function getActualLanguage(language) {
    let result = language;
    if (result === 'auto') {
        if (__ANDROID__) {
            // N Device.language reads app config which thus does return locale app language and not device language
            language = result = java.util.Locale.getDefault().toLanguageTag();
        } else {
            language = result = Device.language;
        }
    }

    if (supportedLanguages.indexOf(result) === -1) {
        result = result.split('-')[0].toLowerCase();
        if (supportedLanguages.indexOf(result) === -1) {
            result = 'en';
        }
    }

    switch (result) {
        // case 'cs':
        //     result = 'cz';
        //     break;
        case 'jp':
            result = 'ja';
            break;
        case 'lv':
            result = 'la';
            break;
    }

    return [result, language];
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

prefs.on(`key:${SETTINGS_LANGUAGE}`, () => {
    const newLanguage = ApplicationSettings.getString(SETTINGS_LANGUAGE, DEFAULT_LOCALE);
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
    globalObservable.notify({ eventName: SETTINGS_LANGUAGE, data: lang, clock_24: true });
});

let currentLocale: any = null;
export function getLocaleDisplayName(locale?, canReturnEmpty = false) {
    if (__IOS__) {
        if (!currentLocale) {
            currentLocale = NSLocale.alloc().initWithLocaleIdentifier(lang);
        }
        const localeStr = (currentLocale as NSLocale).displayNameForKeyValue(NSLocaleIdentifier, locale || lang);
        return localeStr ? capitalize(localeStr) : canReturnEmpty ? undefined : locale || lang;
    } else {
        if (!currentLocale) {
            currentLocale = java.util.Locale.forLanguageTag(lang);
        }
        return capitalize(java.util.Locale.forLanguageTag(locale || lang).getDisplayName(currentLocale as java.util.Locale));
    }
}
export function getCurrentISO3Language() {
    return getISO3Language(lang);
}
async function internalSelectLanguage(currentLanguage = ApplicationSettings.getString(SETTINGS_LANGUAGE, DEFAULT_LOCALE)) {
    // try {
    const actions = SUPPORTED_LOCALES;
    let selectedIndex = -1;
    const options = [{ name: lc('auto'), data: 'auto' }].concat(actions.map((k) => ({ name: getLocaleDisplayName(k.replace('_', '-')), data: k }))).map((d, index) => {
        const selected = currentLanguage === d.data;
        if (selected) {
            selectedIndex = index;
        }
        return {
            ...d,
            boxType: 'circle',
            type: 'checkbox',
            value: selected
        };
    });
    return showAlertOptionSelect(
        {
            height: Math.min(actions.length * 56, ALERT_OPTION_MAX_HEIGHT),
            rowHeight: 56,
            selectedIndex,
            options
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
            ApplicationSettings.setString(SETTINGS_LANGUAGE, result.data);
        }
    } catch (err) {
        showError(err);
    }
}
export async function selectMapLanguage() {
    try {
        const result = await internalSelectLanguage(ApplicationSettings.getString('map_language', ApplicationSettings.getString('language', 'en'));
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
            formatStr = 'H [h] mm [m]';
        } else {
            formatStr = 'm [m]';
        }
    }
    return dayjs(thedate).format(formatStr);
}

// TODO: on android 13 check for per app language, we dont need to store it
setLang(deviceLanguage);

if (__ANDROID__) {
    Application.android.on(Application.android.activityStartedEvent, () => {
        // on android after switching to auto we dont get the actual language
        // before an activity restart
        const lang = ApplicationSettings.getString(SETTINGS_LANGUAGE, DEFAULT_LOCALE);
        if (lang === 'auto') {
            const [actualNewLang, trueNewLang] = getActualLanguage(lang);
            if (actualNewLang !== get(langStore)) {
                langStore.set(actualNewLang);
                setFullLanguageCode(trueNewLang);
            }
        }
    });
}

export { l, lc, lt, lu };
export const sl = derived([langStore], () => l);
export const slc = derived([langStore], () => lc);
export const slt = derived([langStore], () => lt);
export const slu = derived([langStore], () => lu);
// export const sconvertDuration = derived([langStore], () => convertDuration);
export const scformatDate = derived(langStore, () => formatDate);
export const scformatTime = derived([langStore, clock_24Store], () => formatTime);
export const sgetLocaleDisplayName = derived([langStore], () => getLocaleDisplayName);
