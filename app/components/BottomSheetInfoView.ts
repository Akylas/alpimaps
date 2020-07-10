import { Component, Prop } from 'vue-property-decorator';
import { Item } from '~/mapModules/ItemsModule';
import BaseVueComponent from './BaseVueComponent';
import ItemFormatter from '~/mapModules/ItemFormatter';
import { convertElevation } from '~/helpers/formatter';

function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const ret: any = {};
    keys.forEach(key => {
        ret[key] = obj[key];
    });
    return ret;
}
function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const ret: any = {};
    Object.keys(obj).forEach(key => {
        if (keys.indexOf(key as any) === -1) {
            ret[key] = obj[key];
        }
    });
    return ret;
}

const PROPS_TO_SHOW = ['ele'];

@Component({})
export default class BottomSheetInfoView extends BaseVueComponent {
    @Prop()
    item: Item;
    @Prop({ default: false })
    updating: boolean;
    _formatter: ItemFormatter;

    mounted() {
        super.mounted();
    }
    destroyed() {
        this._formatter = null;
        super.destroyed();
    }

    get nbPropsToDraw() {
        return this.propsToDraw.length;
    }
    get propsToDraw() {
        if (this.item) {
            const props = this.item.properties;
            if (props) {
                return PROPS_TO_SHOW.filter(k => props.hasOwnProperty(k));
            }
        }
        return [];
    }
    get propValue() {
        return prop => {
            switch (prop) {
                case 'ele':
                    return convertElevation(this.item.properties[prop]);
            }
            return this.item.properties[prop];
        };
    }
    get propIcon() {
        return prop => {
            // console.log('propIcon', prop);
            switch (prop) {
                case 'ele':
                    return 'mdi-elevation-rise';
            }
            return null;
        };
    }
    get columns() {
        return `auto,${Array(this.nbPropsToDraw + 1).join('*,')}auto`;
    }

    get formatter() {
        if (!this._formatter && this.$getMapComponent()) {
            this._formatter = this.$getMapComponent().mapModule('formatter');
        }
        return this._formatter;
    }
    get itemIcon() {
        if (this.item) {
            return this.formatter.geItemIcon(this.item);
        }
        return [];
    }

    get itemTitle() {
        if (this.item) {
            return this.formatter.getItemTitle(this.item);
        }
    }
    get itemSubtitle() {
        if (this.item) {
            return this.formatter.getItemSubtitle(this.item);
        }
    }
    // @Watch('routeItem')
    // onRouteChanged() {
    //     if (this.currentLocation) {
    //         this.updateRouteItemWithPosition(this.currentLocation);
    //     }
    // }

    showRawData() {
        const { zoomBounds, route, styleOptions, vectorElement, ...others } = this.item;
        this.$alert(JSON.stringify(others, null, 2));
    }
}
