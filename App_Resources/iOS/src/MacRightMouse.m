#import "MacRightMouse.h"
#import <objc/message.h>

#if TARGET_OS_MACCATALYST
// AppKit is loaded in a Catalyst app but its headers are not available: NSEvent through the runtime
static const unsigned long long NSEventMaskRightMouseDown = 1ULL << 3;
static const unsigned long long NSEventMaskRightMouseUp = 1ULL << 4;
static const unsigned long long NSEventMaskRightMouseDragged = 1ULL << 7;
static const NSUInteger NSEventTypeRightMouseDown = 3;
static const NSUInteger NSEventTypeRightMouseUp = 4;

// an AppKit window point (origin bottom left, AppKit points) in the UIKit window, which may be scaled
static CGPoint UIKitWindowPoint(id event, UIWindow *window) {
    id nsWindow = ((id (*)(id, SEL))objc_msgSend)(event, NSSelectorFromString(@"window"));
    id contentView = ((id (*)(id, SEL))objc_msgSend)(nsWindow, NSSelectorFromString(@"contentView"));
    CGRect content = ((CGRect (*)(id, SEL))objc_msgSend)(contentView, NSSelectorFromString(@"frame"));
    CGPoint point = ((CGPoint (*)(id, SEL))objc_msgSend)(event, NSSelectorFromString(@"locationInWindow"));
    CGFloat ratio = content.size.width > 0 ? window.bounds.size.width / content.size.width : 1;
    return CGPointMake(point.x * ratio, (content.size.height - point.y) * ratio);
}
#endif

@implementation MacRightMouse {
    id _monitor;
    BOOL _tracking;
}

+ (instancetype)startForView:(UIView *)view handler:(void (^)(MacRightMousePhase, CGPoint))handler {
#if TARGET_OS_MACCATALYST
    MacRightMouse *instance = [MacRightMouse new];
    __weak UIView *weakView = view;
    __weak MacRightMouse *weakInstance = instance;
    id (^monitorBlock)(id) = ^id(id event) {
        UIView *strongView = weakView;
        MacRightMouse *strongInstance = weakInstance;
        UIWindow *window = strongView.window;
        if (!strongView || !strongInstance || !window) {
            return event;
        }
        CGPoint windowPoint = UIKitWindowPoint(event, window);
        NSUInteger type = ((NSUInteger (*)(id, SEL))objc_msgSend)(event, NSSelectorFromString(@"type"));
        if (type == NSEventTypeRightMouseDown) {
            // only presses on the view itself, not on what is drawn over it
            UIView *hit = [window hitTest:windowPoint withEvent:nil];
            if (hit != strongView) {
                return event;
            }
            strongInstance->_tracking = YES;
        } else if (!strongInstance->_tracking) {
            return event;
        }
        if (type == NSEventTypeRightMouseUp) {
            strongInstance->_tracking = NO;
        }
        MacRightMousePhase phase = type == NSEventTypeRightMouseDown ? MacRightMousePhaseDown : (type == NSEventTypeRightMouseUp ? MacRightMousePhaseUp : MacRightMousePhaseDragged);
        handler(phase, [strongView convertPoint:windowPoint fromView:nil]);
        return nil;
    };
    unsigned long long mask = NSEventMaskRightMouseDown | NSEventMaskRightMouseUp | NSEventMaskRightMouseDragged;
    instance->_monitor = ((id (*)(id, SEL, unsigned long long, id))objc_msgSend)(NSClassFromString(@"NSEvent"), NSSelectorFromString(@"addLocalMonitorForEventsMatchingMask:handler:"), mask, monitorBlock);
    return instance;
#else
    return nil;
#endif
}

- (void)stop {
#if TARGET_OS_MACCATALYST
    if (_monitor) {
        ((void (*)(id, SEL, id))objc_msgSend)(NSClassFromString(@"NSEvent"), NSSelectorFromString(@"removeMonitor:"), _monitor);
        _monitor = nil;
    }
#endif
}

@end
