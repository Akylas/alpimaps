import { lc } from '@nativescript-community/l'
import { ApplicationSettings, Observable } from '@nativescript/core';
import { get, writable } from 'svelte/store';
import type { RoutesType } from '~/mapModules/CustomLayersModule';

function settingsStore<T = any>(key, defaultValue: T) {
    const tpof = typeof defaultValue;
    let updateMethod;
    let startValue;
    switch (tpof) {
        case 'boolean':
            updateMethod = ApplicationSettings.setBoolean;
            startValue = ApplicationSettings.getBoolean(key, defaultValue as boolean);
            break;
        case 'number':
            updateMethod = ApplicationSettings.setNumber;
            startValue = ApplicationSettings.getNumber(key, defaultValue as number);
            break;

        default:
            updateMethod = ApplicationSettings.setString;
            startValue = ApplicationSettings.getString(key, defaultValue as string);
            break;
    }
    const store = writable<T>(startValue);
    let ignoreUpdate = true;
    store.subscribe((v) => {
        if (ignoreUpdate) {
            ignoreUpdate = false;
            return;
        }
        if (v === defaultValue) {
            ApplicationSettings.remove(key);
        } else {
            updateMethod(key, v);
        }
    });
    (store as any).reset = () => {
        store.set(defaultValue);
    };
    return store;
}

export const watchingLocation = writable(false);
export const queryingLocation = writable(false);
export const projectionModeSpherical = settingsStore('showGlobe', false);
export const show3DBuildings = settingsStore('show3DBuildings', false);
export const showContourLines = settingsStore('showContourLines', true);
export const showSlopePercentages = settingsStore('showSlopePercentages', false);
export const showRoutes = settingsStore('showRoutes', false);
export const contourLinesOpacity = settingsStore('contourLinesOpacity', -1);
export const mapFontScale = settingsStore('mapFontScale', 1);
export const preloading = settingsStore('preloading', true);
export const rotateEnabled = settingsStore('mapRotateEnabled', false);
export const pitchEnabled = settingsStore('mapPitchEnabled', false);
export const routesType = settingsStore<RoutesType>('routes_type', 0);
export const useOfflineGeocodeAddress = settingsStore('useOfflineGeocodeAddress', true);
export const useSystemGeocodeAddress = settingsStore('useSystemGeocodeAddress', true);
export const emphasisRails = settingsStore('emphasisRails', false);
export const emphasisDrinkingWater = settingsStore('emphasisDrinkingWater', false);
export const showSubBoundaries = settingsStore('showSubBoundaries', true);
export const showPolygonsBorder  = settingsStore('showPolygonsBorder', true);
export const showRoadShields = settingsStore('showRoadShields', true);
export const showRouteShields = settingsStore('showRouteShields', false);
export const showItemsLayer = settingsStore('showItemsLayer', true);
export const itemLock = writable(false);
export const immersive = settingsStore('immersive', false);
export const showAscents = settingsStore('elevation_profile_show_ascents', true);
export const showGradeColors = settingsStore('elevation_profile_show_grade_colors', true);
export const clickHandlerLayerFilter = settingsStore('clickHandlerLayerFilter', '(transportation_name|route|.*::(icon|label))');

function nutiSettings(type, key) {
    const defaultSettings = {
        id: 'setting',
        nutiProps,
        key,
        title: nutiProps.getTitle(key),
        description: nutiProps.getTitle(key)
    };
    switch(type) {
        case 'zoom': 
            return {
                min: 0,
                max: 24,
                step: 1,
                type: 'slider',
                rightValue: () => nutiProps[key] ?? lc('notset'),
                currentValue: () => Math.max(0, nutiProps[key] ?? -1),
                formatter: (value) => value,
                transformValue: (value, item) => value,
                valueFormatter: (value, item) => value,
                ...defaultSettings
            }
    }
}

const nutiParams = {
    city_min_zoom: {
        title: lc('city_min_zoom'),
        description: lc('city_min_zoom_desc'),
        settingsOptionsType: 'zoom'
    },
    building_min_zoom: {
        title: lc('building_min_zoom'),
        description: lc('building_min_zoom_desc'),
        settingsOptionsType: 'zoom'
    },
    routes_dash_min_zoom: {
        title: lc('routes_dash_min_zoom'),
        description: lc('routes_dash_min_zoom_desc'),
        settingsOptionsType: 'zoom'
    },
    building_zoom: {
        title: lc('building_zoom'),
        description: lc('building_zoom_desc'),
        settingsOptionsType: 'zoom'
    },
    scrub_pattern_zoom: {
        title: lc('scrub_pattern_zoom'),
        description: lc('scrub_pattern_zoom_desc'),
        settingsOptionsType: 'zoom'
    },
    scree_pattern_zoom: {
        title: lc('scree_pattern_zoom'),
        description: lc('scree_pattern_zoom_desc'),
        settingsOptionsType: 'zoom'
    },
    rock_pattern_zoom: {
        title: lc('rock_pattern_zoom'),
        description: lc('rock_pattern_zoom_desc'),
        settingsOptionsType: 'zoom'
    },
    forest_pattern_zoom: {
        title: lc('forest_pattern_zoom'),
        description: lc('forest_pattern_zoom_desc'),
        settingsOptionsType: 'zoom'
    }
    
};
const nutiPropsObj = new Observable();
Object.assign(nutiPropsObj, nutiParams);
Object.keys(nutiPropsObj).forEach(key=>{
    const obj = nutiPropsObj[key]!
    const defaultValue = obj.defaultValue ?? null;
    const tpof = typeof defaultValue;
    let updateMethod;
    let startValue;
    switch (tpof) {
        case 'boolean':
            updateMethod = ApplicationSettings.setBoolean;
            startValue = ApplicationSettings.getBoolean(key, defaultValue as boolean);
            break;
        case 'number':
            updateMethod = ApplicationSettings.setNumber;
            startValue = ApplicationSettings.getNumber(key, defaultValue as number);
            break;

        default:
            updateMethod = ApplicationSettings.setString;
            startValue = ApplicationSettings.getString(key, defaultValue as string);
            break;
    }
    obj.value = startValue;
    obj.updateMethod = updateMethod;
    
})
export const nutiProps = new Proxy(nutiPropsObj, {
  set: function (target, key, value) {
      console.log('set', key, value);
      const obj = target[key];
      const settingKey = obj.key || key;
      obj.value = value;
      if (value === obj.defaultValue) {
          ApplicationSettings.remove(settingKey);
      } else {
          obj.updateMethod(settingKey, value);
      }
      target.notify({eventName:'change', object:this, key, value});
      return true;
  },
  get(target, name, receiver) {
      console.log('get', name);
      if(target[name] && typeof target[name] === 'object') {
          return target[name].value;
      } else {
          switch(name) {
              case 'getTitle':
                  return function(key){
                      return target[key].title;
                  }
              case 'getDescription':
                  return function(key){
                      return target[key].description;                     }
              case 'getKey':
                  return function(key){
                      return target[key].key || key;
                  }
              case 'getDefaultValue':
                  return function(key){
                      return target[key].defaultValue;
                  }
                case 'getSettingsOptions':
                  return function(key){
                      return nutiSettings(target[key].settingsOptionsType, key);
                  }
                  case 'getKeys':
                      return function() {
                          return Object.keys(nutiParams);
                      }
              default:
                  const orig = target[name];
                  if (typeof orig === 'function') {
                      return orig.bind(target);
                  }           
                  return Reflect.get(target, name, receiver);
          }
          
      }
  }
}) as any;
