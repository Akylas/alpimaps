import { CollectionView } from '@nativescript-community/ui-collectionview';
interface IOSCollectionView extends CollectionView {
    onReorderLongPress?(recognizer: UILongPressGestureRecognizer);
}

@NativeClass
export default class ReorderLongPressHandler extends NSObject {
    private _owner: WeakRef<IOSCollectionView>;

    public static initWithOwner(owner: WeakRef<IOSCollectionView>): ReorderLongPressHandler {
        const handler = ReorderLongPressHandler.new() as ReorderLongPressHandler;
        handler._owner = owner;
        return handler;
    }

    public longPress(recognizer: UILongPressGestureRecognizer): void {
        const owner = this._owner && this._owner.get();
        if (owner) {
            owner.onReorderLongPress(recognizer);
        }
    }

    public static ObjCExposedMethods = {
        longPress: { returns: interop.types.void, params: [interop.types.id] }
    };
}
