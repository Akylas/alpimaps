import { l, lc, loadLocaleJSON, lt, lu } from '@nativescript-community/l';
import { ApplicationSettings } from '@nativescript/core';
import { getString, setString } from '@nativescript/core/application-settings';
import { Device } from '@nativescript/core/platform';
import dayjs from 'dayjs';
import updateLocale from 'dayjs/plugin/updateLocale';
import { derived, writable } from 'svelte/store';
import { prefs } from '~/services/preferences';
const supportedLanguages = SUPPORTED_LOCALES;
import OptionSelect from '~/components/OptionSelect.svelte';
import { showBottomSheet } from '~/components/bottomsheet';

dayjs.extend(updateLocale);
export let lang;
let currentLocale = null;
export const $lang = writable(null);
const onLanguageChangedCallbacks = [];
export function onLanguageChanged(callback) {
    onLanguageChangedCallbacks.push(callback);
}

$lang.subscribe((newLang: string) => {
    lang = newLang;
    // console.log('changed lang', lang, Device.region);
    try {
        require(`dayjs/locale/${newLang}`);
    } catch (err) {
        console.log('failed to load dayjs locale', lang, `dayjs/locale/${newLang}`, err);
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
        console.log('failed to load lang json', lang, `~/i18n/${lang}.json`, err);
    }
    onLanguageChangedCallbacks.forEach((c) => c(lang));
});
function setLang(newLang) {
    newLang = getOwmLanguage(newLang);
    if (supportedLanguages.indexOf(newLang) === -1) {
        newLang = 'en';
    }
    console.log('changed lang', lang, Device.region);
    currentLocale = null;
    $lang.set(newLang);
}

let deviceLanguage = getString('language');
if (!deviceLanguage) {
    deviceLanguage = Device.language.split('-')[0].toLowerCase();
    setString('language', deviceLanguage);
}
// console.log('deviceLanguage', deviceLanguage);
function getOwmLanguage(language) {
    if (language === 'cs') {
        // Czech
        return 'cz';
    } else if (language === 'ko') {
        // Korean
        return 'kr';
    } else if (language === 'lv') {
        // Latvian
        return 'la';
    } else {
        return language;
    }
}


function titlecase(value) {
    return value.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
export function getLocaleDisplayName(locale?) {
    console.log('getLocaleDisplayName', locale);
    if (global.isIOS) {
        if (!currentLocale) {
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
        const result = await showBottomSheet<any>({
            view: OptionSelect,
            props: {
                title: lc('select_language'),
                options: actions.map((k) => ({ name: getLocaleDisplayName(k), data: k }))
            },
            trackingScrollView: 'collectionView'
        });
        if (result && actions.indexOf(result.data) !== -1) {
            ApplicationSettings.setString('language', result.data);
        }
    } catch (err) {
        this.showError(err);
    }
}
export function convertTime(date: number | string | dayjs.Dayjs, formatStr: string) {
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
    // console.log('convertDuration', date, formatStr, test, result);
    return result;
}

// const rtf = new Intl.RelativeTimeFormat('es');

prefs.on('key:language', () => {
    const newLanguage = getString('language');
    console.log('language changed', newLanguage);
    // on pref change we are updating
    if (newLanguage === lang) {
        return;
    }
    setLang(newLanguage);
});

setLang(deviceLanguage);

export { l, lc, lu, lt };
export const sl = derived([$lang], () => l);
export const slc = derived([$lang], () => lc);
export const slt = derived([$lang], () => lt);
export const slu = derived([$lang], () => lu);
export const sconvertDuration = derived([$lang], () => convertDuration);
export const scconvertTime = derived([$lang], () => convertTime);
export const sgetLocaleDisplayName = derived([$lang], () => getLocaleDisplayName);
