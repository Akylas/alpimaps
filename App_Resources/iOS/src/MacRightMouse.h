#import <UIKit/UIKit.h>

typedef NS_ENUM(NSInteger, MacRightMousePhase) {
    MacRightMousePhaseDown = 0,
    MacRightMousePhaseDragged = 1,
    MacRightMousePhaseUp = 2
};

/**
 * The right mouse button over a view, on Mac Catalyst. UIKit gives a pan no right-button drags and
 * reports a right-click as a context menu request on mouse down, so AppKit's events are read
 * instead. The presses landing on the view are consumed. Elsewhere than Mac Catalyst, nothing.
 */
@interface MacRightMouse : NSObject
/** location is in the view's coordinates */
+ (nullable instancetype)startForView:(nonnull UIView *)view handler:(nonnull void (^)(MacRightMousePhase phase, CGPoint location))handler;
- (void)stop;
@end
