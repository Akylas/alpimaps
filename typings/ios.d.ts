declare function CGSizeMake(width: number, height: number): CGSize;

declare function CGRectMake(x: number, y: number, width: number, height: number): CGRect;

// Mac Catalyst only, missing from the iOS typings.
interface UIWindowSceneGeometry {
    systemFrame: CGRect;
}

// App_Resources/iOS/src/MacRightMouse.h
declare const enum MacRightMousePhase {
    Down = 0,
    Dragged = 1,
    Up = 2
}
declare class MacRightMouse extends NSObject {
    static startForViewHandler(view: UIView, handler: (phase: MacRightMousePhase, location: CGPoint) => void): MacRightMouse;
    stop(): void;
}
