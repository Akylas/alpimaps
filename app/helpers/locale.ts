import { l, lc, loadLocaleJSON, lt, lu } from '@nativescript-community/l';
import { ApplicationSettings } from '@nativescript/core';
import { getString, setString } from '@nativescript/core/application-settings';
import { Device } from '@nativescript/core/platform';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import localizedFormat from 'dayjs/plugin/localizedFormat';
// import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import updateLocale from 'dayjs/plugin/updateLocale';
import utc from 'dayjs/plugin/utc';
import { derived, writable } from 'svelte/store';
import { packageService } from '~/services/PackageService';
import { prefs } from '~/services/preferences';
import { showBottomSheet } from '~/utils/svelte/bottomsheet';
import { createGlobalEventListener, globalObservable } from '~/variables';
const supportedLanguages = SUPPORTED_LOCALES;

dayjs.extend(updateLocale);
// dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.extend(utc);

export let lang;
let default24Clock = false;
if (__ANDROID__) {
    default24Clock = android.text.format.DateFormat.is24HourFormat(ad.getApplicationContext());
}
export let clock_24 = ApplicationSettings.getBoolean('clock_24', default24Clock);
console.log('clock_24', clock_24);
let currentLocale = null;
export const langStore = writable(null);
export const clock_24Store = writable(null);
export const onLanguageChanged = createGlobalEventListener('language');

async function setLang(newLang) {
    newLang = getActualLanguage(newLang);
    if (supportedLanguages.indexOf(newLang) === -1) {
        newLang = 'en';
    }
    DEV_LOG && console.log('changed lang', newLang, Device.region);
    currentLocale = null;
    if (lang === newLang) {
        return;
    }
    lang = newLang;
    if (lang === null) {
        return;
    }
    // console.log('changed lang', lang, newLang, Device.region);
    try {
        require(`dayjs/locale/${newLang}`);
    } catch (err) {
        console.error('failed to load dayjs locale', lang, `dayjs/locale/${newLang}`, err);
    }
    dayjs.locale(lang); // switch back to default English locale globally
    if (lang === 'fr') {
        dayjs.updateLocale('fr', {
            calendar: {
                lastDay: '[Hier à] LT',
                sameDay: "[Aujourd'hui à] LT",
                nextDay: '[Demain à] LT',
                lastWeek: 'dddd [dernier] [à] LT',
                nextWeek: 'dddd [à] LT',
                sameElse: 'L'
            }
        });
    }

    try {
        const localeData = require(`~/i18n/${lang}.json`);
        loadLocaleJSON(localeData);
    } catch (err) {
        console.error('failed to load lang json', lang, `~/i18n/${lang}.json`, err);
    }
    globalObservable.notify({ eventName: 'language', data: lang });
    langStore.set(newLang);
}
function getActualLanguage(language) {
    if (language === 'auto') {
        language = Device.language;
    }
    language = language.split('-')[0].toLowerCase();
    switch (language) {
        case 'cs':
            return 'cz';
        case 'jp':
            return 'ja';
        case 'lv':
            return 'la';
        default:
            return language;
    }
}

function titlecase(str: string) {
    let upper = true;
    let newStr = '';
    for (let i = 0, l = str.length; i < l; i++) {
        if (str[i] === ' ') {
            upper = true;
            newStr += ' ';
            continue;
        }
        newStr += upper ? str[i].toUpperCase() : str[i].toLowerCase();
        upper = false;
    }
    return newStr;
}
export function getLocaleDisplayName(locale?) {
    if (__IOS__) {
        if (!currentLocale) {
            //@ts-ignore
            currentLocale = NSLocale.alloc().initWithLocaleIdentifier(lang);
        }
        return titlecase(currentLocale.localizedStringForLanguageCode(locale || lang));
    } else {
        if (!currentLocale) {
            currentLocale = java.util.Locale.forLanguageTag(lang);
        }
        return titlecase(java.util.Locale.forLanguageTag(locale || lang).getDisplayLanguage(currentLocale));
    }
}

export async function selectLanguage() {
    try {
        const actions = SUPPORTED_LOCALES;
        const OptionSelect = (await import('~/components/OptionSelect.svelte')).default;
        const result = await showBottomSheet<any>({
            parent: null,
            view: OptionSelect,
            props: {
                title: lc('select_language'),
                options: [{ name: lc('auto'), data: 'auto' }].concat(actions.map((k) => ({ name: getLocaleDisplayName(k), data: k })))
            },
            trackingScrollView: 'collectionView'
        });
        if (result && result.data) {
            ApplicationSettings.setString('language', result.data);
        }
    } catch (err) {
        this.showError(err);
    }
}
export function formatDate(date: number | string | Date, formatStr: string) {
    if (date) {
        if (!date['format']) {
            date = dayjs(date);
        }
        return (date as dayjs.Dayjs).format(formatStr);
    }
    return '';
}

export function convertDuration(date, formatStr: string = 'H [hrs], m [min]') {
    const test = new Date(date);
    test.setTime(test.getTime() + test.getTimezoneOffset() * 60 * 1000);
    const result = dayjs(test).format(formatStr);
    return result;
}

// const rtf = new Intl.RelativeTimeFormat('es');

prefs.on('key:language', () => {
    const newLanguage = getString('language');
    // on pref change we are updating
    if (newLanguage === lang) {
        return;
    }
    setLang(newLanguage);
});

prefs.on('key:clock_24', () => {
    const newValue = ApplicationSettings.getBoolean('clock_24', default24Clock);
    DEV_LOG && console.log('clock_24 changed', newValue);
    clock_24 = newValue;
    clock_24Store.set(newValue);
});

let currentLanguage = getString('language', DEFAULT_LOCALE);
if (!currentLanguage) {
    currentLanguage = Device.language.split('-')[0].toLowerCase();
    packageService.currentLanguage = currentLanguage;
    setString('language', currentLanguage);
} else {
    setLang(currentLanguage);
}

export { l, lc, lu, lt };
export const sl = derived(langStore, () => l);
export const slc = derived(langStore, () => lc);
export const slt = derived(langStore, () => lt);
export const slu = derived(langStore, () => lu);
export const sconvertDurationSeconds = derived(langStore, () => convertDurationSeconds);
export const scformatDate = derived(langStore, () => formatDate);
export const scformatTime = derived([langStore, clock_24Store], () => formatTime);
export const sgetLocaleDisplayName = derived(langStore, () => getLocaleDisplayName);
