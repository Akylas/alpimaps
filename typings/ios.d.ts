declare function CGSizeMake(width: number, height: number): CGSize;

declare function CGRectMake(x: number, y: number, width: number, height: number): CGRect;

// Mac Catalyst only, missing from the iOS typings.
interface UIWindowSceneGeometry {
    systemFrame: CGRect;
}
