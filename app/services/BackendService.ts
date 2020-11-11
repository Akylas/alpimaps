/* eslint-disable no-redeclare */
// import { getBoolean, getNumber, getString, remove, setBoolean, setNumber, setString } from '@nativescript/core/application-settings';
import { Observable } from '@nativescript/core/data/observable';
import {
    getBoolean,
    getNumber,
    getString,
    remove,
    setBoolean,
    setNumber,
    setString,
} from '@nativescript/core/application-settings';

const firstRun = getBoolean('firstRun', true);
if (firstRun) {
    setBoolean('firstRun', false);
}

export const stringProperty = (target: Object, key: string | symbol) => {
    // property value
    const actualkey = key.toString();
    const innerKey = '_' + actualkey;
    target[innerKey] = getString(actualkey);

    // property getter
    const getter = function () {
        return this[innerKey];
    };

    // property setter
    const setter = function (newVal) {
        this[innerKey] = newVal;
        if (newVal === undefined || newVal === null) {
            return remove(actualkey);
        }
        return setString(actualkey, newVal);
    };
    // Create new property with getter and setter
    Object.defineProperty(target, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true,
    });
};
export const objectProperty = (target: Object, key: string | symbol) => {
    // property value
    const actualkey = key.toString();
    const innerKey = '_' + actualkey;

    const savedValue = getString(actualkey);
    target[innerKey] = savedValue !== undefined ? JSON.parse(savedValue) : undefined;

    // property getter
    const getter = function () {
        return this[innerKey];
    };

    // property setter
    const setter = function (newVal) {
        this[innerKey] = newVal;
        if (newVal === undefined) {
            return remove(actualkey);
        }
        return setString(actualkey, JSON.stringify(newVal));
    };
    // Create new property with getter and setter
    Object.defineProperty(target, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true,
    });
};

interface PropertyDecoratorOptions<T> {
    default?: T;
}
function createGetter<T>(actualkey: string, innerKey: string, options: PropertyDecoratorOptions<T>) {
    return function () {
        return this[innerKey] as T;
    };
}
function createSetter<T>(actualkey: string, innerKey: string, options: PropertyDecoratorOptions<T>, setFunc: Function) {
    return function (newVal: T) {
        this[innerKey] = newVal;
        if (newVal === undefined) {
            return remove(actualkey);
        }
        return setFunc(actualkey, newVal);
    };
}
function nativePropertyGenerator<T>(
    target: Object,
    key: any,
    options: PropertyDecoratorOptions<T>,
    getFunc: Function,
    setFunc: Function
) {
    const actualkey = key.toString();
    const innerKey = '_' + actualkey;
    const savedValue = getFunc(actualkey);
    if ((savedValue === undefined || savedValue === null) && options.hasOwnProperty('default')) {
        target[innerKey] = options.default;
    } else {
        target[innerKey] = savedValue;
    }
    Object.defineProperty(target, key, {
        get: createGetter<T>(actualkey, innerKey, options),
        set: createSetter<T>(actualkey, innerKey, options, setFunc),
        enumerable: true,
        configurable: true,
    });
}
export function booleanProperty(target: any, k?, desc?: PropertyDescriptor): any;
export function booleanProperty(options: PropertyDecoratorOptions<boolean>): (target: any, k?, desc?: PropertyDescriptor) => any;
export function booleanProperty(...args) {
    if (args.length === 1) {
        /// this must be a factory
        return function (target: any, key?: string, descriptor?: PropertyDescriptor) {
            return nativePropertyGenerator<boolean>(target, key, args[0] || {}, getBoolean, setBoolean);
        };
    } else {
        const options = typeof args[1] === 'string' ? undefined : args[0];
        const startIndex = !!options ? 1 : 0;
        return nativePropertyGenerator<boolean>(args[startIndex], args[startIndex + 1], options || {}, getBoolean, setBoolean);
    }
}
export const numberProperty = (target: Object, key: string | symbol) => {
    // property value
    const actualkey = key.toString();
    const innerKey = '_' + actualkey;
    target[innerKey] = getNumber(actualkey);

    // property getter
    const getter = function () {
        return this[innerKey];
    };

    // property setter
    const setter = function (newVal) {
        this[innerKey] = newVal;
        if (newVal === undefined) {
            return remove(actualkey);
        }
        return setNumber(actualkey, newVal);
    };
    // Create new property with getter and setter
    Object.defineProperty(target, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true,
    });
};

/**
 * Parent service class. Has common configs and methods.
 */
export default class BackendService extends Observable {}
