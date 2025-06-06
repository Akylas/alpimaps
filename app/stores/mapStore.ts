import { lc } from '@nativescript-community/l';
import { closePopover, showPopover } from '@nativescript-community/ui-popover/svelte';
import { ApplicationSettings, Observable } from '@nativescript/core';
import { get, writable } from 'svelte/store';
import type { RoutesType } from '~/mapModules/CustomLayersModule';
import { showError } from '@shared/utils/showError';
import { showSliderPopover } from '~/utils/ui/index.common';
import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
import { tryCatchFunction } from '@shared/utils/ui';

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

export const showSlopePercentages = settingsStore('showSlopePercentages', false);

export const preloading = settingsStore('preloading', true);
export const rotateEnabled = settingsStore('mapRotateEnabled', false);
export const pitchEnabled = settingsStore('mapPitchEnabled', false);

export const useOfflineGeocodeAddress = settingsStore('useOfflineGeocodeAddress', true);
export const useSystemGeocodeAddress = settingsStore('useSystemGeocodeAddress', true);

export const showItemsLayer = settingsStore('showItemsLayer', true);
export const itemLock = writable(false);
export const immersive = settingsStore('immersive', false);
export const showAscents = settingsStore('elevation_profile_show_ascents', true);
export const showGradeColors = settingsStore('elevation_profile_show_grade_colors', true);
export const clickHandlerLayerFilter = settingsStore('clickHandlerLayerFilter', '(transportation_name|route|.*::(icon|label))');


const layersParams = {
    showSlopePercentages: {
        title: lc('show_percentage_slopes'),
        settingsOptionsType: 'boolean',
        defaultValue: true,
        icon: 'mdi-signal',
        visible: (customLayers) => !!customLayers?.hasTerrain
    },
}
const nutiParams = {
    _fontscale: {
        title: lc('map_font_scale'),
        description: lc('map_font_scale_desc'),
        settingsOptionsType: 'number',
        defaultValue: 1,
        min: 0.5,
        max: 4
    },
    contours: {
        title: lc('show_contour_lines'),
        settingsOptionsType: 'boolean',
        defaultValue: true,
        icon: 'mdi-bullseye',
        visible: (customLayers) => !!customLayers?.hasLocalData,
        onLongPress: tryCatchFunction(async (event) => {
              await showSliderPopover({
                  debounceDuration: 100,
                  anchor: event.object,
                  ...nutiProps.getSettingsOptions('contoursOpacity'),
                  vertPos: VerticalPosition.ABOVE,
                  value: nutiProps['contoursOpacity'],
                  onChange(value) {
                      nutiProps['contoursOpacity'] = value;
                  }
              });
        })
    },
    contoursOpacity: {
        title: lc('contour_lines_opacity'),
        description: lc('contour_lines_opacity_desc'),
        settingsOptionsType: 'number',
        defaultValue: null
    },
    buildings: {
        title: lc('buildings_3d'),
        settingsOptionsType: 'boolean',
        defaultValue: false,
        icon: 'mdi-domain',
        visible: (customLayers) => !!customLayers?.hasLocalData,
        nutiTransform: value => !!value ? '2' : '1'
    },
    show_routes: {
        title: lc('show_routes'),
        settingsOptionsType: 'boolean',
        defaultValue: true,
        icon: 'mdi-routes',
        visible: (customLayers) => !!customLayers?.hasRoute,
        onLongPress: tryCatchFunction(async (event) => {
                    const component = (await import('~/components/routes/RoutesTypePopover.svelte')).default;
                    await showPopover({
                        view: component,
                        anchor: event.object,
                        vertPos: VerticalPosition.ALIGN_TOP,
                        horizPos: HorizontalPosition.RIGHT
                    });
                })
    },
    routes_type: {
        icon: 'mdi-routes',
        settingsOptionsType: 'number',
        defaultValue: 0,
        min: 0,
        max: 2,
        step: 1
    },
    polygons_border: {
        title: lc('show_polygone_border'),
        settingsOptionsType: 'boolean',
        defaultValue: false
    },
    road_shields: {
        title: lc('show_road_shields'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    route_shields: {
        title: lc('show_route_shields'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    sub_boundaries: {
        title: lc('show_sub_boundaries'),
        settingsOptionsType: 'boolean',
        defaultValue: true
    },
    emphasis_rails: {
        title: lc('emphasis_rail_tracks'),
        settingsOptionsType: 'boolean',
        defaultValue: false
    },
    highlight_drinking_water: {
        title: lc('emphasis_drinking_water'),
        settingsOptionsType: 'boolean',
        defaultValue: false
    },
    city_min_zoom: {
        title: lc('city_min_zoom'),
        description: lc('city_min_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    building_min_zoom: {
        title: lc('building_min_zoom'),
        description: lc('building_min_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    routes_dash_min_zoom: {
        title: lc('routes_dash_min_zoom'),
        description: lc('routes_dash_min_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    building_zoom: {
        title: lc('building_zoom'),
        description: lc('building_zoom_desc'),
        settingsOptionsType: 'zoom'
    },
    scrub_pattern_zoom: {
        title: lc('scrub_pattern_zoom'),
        description: lc('scrub_pattern_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    scree_pattern_zoom: {
        title: lc('scree_pattern_zoom'),
        description: lc('scree_pattern_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    rock_pattern_zoom: {
        title: lc('rock_pattern_zoom'),
        description: lc('rock_pattern_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    },
    forest_pattern_zoom: {
        title: lc('forest_pattern_zoom'),
        description: lc('forest_pattern_zoom_desc'),
        settingsOptionsType: 'zoom',
        defaultValue: -1
    }
    
};
function nutiTransformForType(type) {
    switch(type) {
        case 'zoom': 
            return null;
        case 'boolean':
            return value => !!value ? '1' : '0'
        case 'number':
            return value => value.toFixed(2)
}
function nutiSettings(type, key, store) {
    const defaultSettings = {
        id: 'setting',
        nutiProps: store,
        key,
        ...store.getProps(key),
        nutiTransform: nutiTransformForType(type)
    };
    switch(type) {
        case 'zoom': 
            return {
                min: 0,
                max: 24,
                step: 1,
                type: 'slider',
                rightValue: () => store[key] != null &&  store[key] !== -1 ? store[key] : lc('notset'),
                currentValue: () => Math.max(0, store[key] ?? -1),
                formatter: (value) => value.toFixed(),
                transformValue: (value, item) => value,
                valueFormatter: (value, item) => value.toFixed(),
                ...defaultSettings
            }
        case 'boolean':
            return {
                type: 'switch',
                value: store[key] ?? false,
                ...defaultSettings
            }
        case 'number':
            return {
                min: 0,
                max: 1,
                step: null,
                type: 'slider',
                rightValue: () => store[key] != null ? store[key].toFixed(2) : lc('notset'),
                currentValue: () => store[key],
                formatter: (value) => value,
                transformValue: (value, item) => value,
                valueFormatter: (value, item) => value.toFixed(2),
                ...defaultSettings
            }
    }
}
function createStore(params){
    let notifyCallback;
    Object.keys(params).forEach(key=>{
        const obj = params[key];
        const nutiTransform = obj.nutiTransform || nutiTransformForType(obj.settingsOptionsType);
        const settingKey = obj.key || key;
        const defaultValue = obj.defaultValue ?? null;
        const tpof = typeof defaultValue;
        let updateMethod;
        let startValue;
        switch (tpof) {
            case 'boolean':
                updateMethod = ApplicationSettings.setBoolean;
                startValue = ApplicationSettings.getBoolean(settingKey, defaultValue as boolean);
                break;
            case 'number':
                updateMethod = ApplicationSettings.setNumber;
                startValue = ApplicationSettings.getNumber(settingKey, defaultValue as number);
                break;
    
            default:
                updateMethod = ApplicationSettings.setString;
                startValue = ApplicationSettings.getString(settingKey, defaultValue as string);
                break;
        }
        console.log('startValue', key, startValue, settingKey);
        obj.value = startValue;
        obj.store = writable(startValue);
        obj.store.ignoreUpdate = false;
        obj.store.subscribe((value) => {
            console.log('store update', key, value, obj.store.ignoreUpdate, !!notifyCallback, obj.nutiTransform);
            if (obj.store.ignoreUpdate) {
                obj.store.ignoreUpdate = false;
                return;
            }
            if (value === defaultValue) {
                ApplicationSettings.remove(key);
            } else {
                updateMethod(key, value);
            }
            notifyCallback?.({eventName:'change', object:nutiProps, key, value, nutiValue: nutiTransform ? nutiTransform(value) : value + ''});
        });
        obj.updateMethod = updateMethod;
        
    })
    const propsObj = new Observable();
    notifyCallback = propsObj.notify.bind(propsObj);
    Object.assign(propsObj, params);
    return new Proxy(propsObj, {
      set: function (target, key, value) {
          try {
              const obj = target[key];
              const settingKey = obj.key || key;
              const nutiTransform = obj.nutiTransform || this.getSettingsOptions(key).nutiTransform;
              console.log('set', key, value, settingKey);
              obj.value = value;
              obj.store.ignoreUpdate = true;
              obj.store.set(value);
              if (value == null || value === obj.defaultValue) {
                  ApplicationSettings.remove(settingKey);
              } else {
                  obj.updateMethod(settingKey, value);
              }
              notifyCallback?.({eventName:'change', object:this, key, value, nutiValue: nutiTransform ? nutiTransform(value) : value + ''});
          } catch (error) {
              showError(error)
          }
          return true;
      },
      get(target, name, receiver) {
          if(target[name] && typeof target[name] === 'object') {
              return target[name].value !== target[name].defaultValue ? target[name].value : null;
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
                  case 'getProps':
                      return function(key){
                          return target[key];
                      }
                  case 'getNutiTransform':
                      return function(key){
                          return target[key].nutiTransform;
                      }
                  case 'getStore':
                      return function(key){
                          return target[key].store;
                      }
                  case 'getNutiValue':
                      return function(key){
                          const obj = target[key];
                          const value = obj.value;
                          if (value != null) {
                              const nutiTransform = obj.nutiTransform || this.getSettingsOptions(key).nutiTransform;
                              return nutiTransform ? nutiTransform(value) : value + '';
                          }
                          return null;
                      }
                    case 'getSettingsOptions':
                      return function(key){
                          return nutiSettings(target[key].settingsOptionsType, key, this);
                      }
                      case 'getKeys':
                          return function() {
                              return Object.keys(params);
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

    
}
export const nutiProps = createStore(nutiParams);
export const layerProps = createStore(layersParams);
