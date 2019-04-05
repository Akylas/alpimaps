import { getBoolean, getNumber, getString, setBoolean, setNumber, setString } from 'tns-core-modules/application-settings';

export const stringProperty = (target: Object, key: string | symbol) => {
    // property value
    const actualkey = key.toString();
    const innerKey = '_' + actualkey;
    target[innerKey] = getString(actualkey);

    // property getter
    const getter = function() {
        return this[innerKey];
    };

    // property setter
    const setter = function(newVal) {
        this[innerKey] = newVal;
        setString(actualkey, newVal);
    };
    // Create new property with getter and setter
    Object.defineProperty(target, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true
    });
};
export const booleanProperty = (target: Object, key: string | symbol) => {
    // property value
    const actualkey = key.toString();
    const innerKey = '_' + actualkey;
    target[innerKey] = getBoolean(actualkey);

    // property getter
    const getter = function() {
        return this[innerKey];
    };

    // property setter
    const setter = function(newVal) {
        this[innerKey] = newVal;
        setBoolean(actualkey, newVal);
    };
    // Create new property with getter and setter
    Object.defineProperty(target, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true
    });
};
export const numberProperty = (target: Object, key: string | symbol) => {
    // property value
    const actualkey = key.toString();
    const innerKey = '_' + actualkey;
    target[innerKey] = getNumber(actualkey);

    // property getter
    const getter = function() {
        return this[innerKey];
    };

    // property setter
    const setter = function(newVal) {
        this[innerKey] = newVal;
        setNumber(actualkey, newVal);
    };
    // Create new property with getter and setter
    Object.defineProperty(target, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true
    });
};

/**
 * Parent service class. Has common configs and methods.
 */
export default class BackendService {
    constructor() {}
}
