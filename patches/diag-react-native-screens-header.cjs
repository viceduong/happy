/**
 * TEMPORARY native diagnostics for slopus/happy#1890. Applied only when
 * HAPPY_HEADER_DIAG=1 (the sideload IPA workflow), after
 * fix-react-native-screens-redundant-bar-hide.cjs.
 *
 * Logs the last 14 navigation-bar events, with a millisecond clock, to an
 * overlay label in the key window (navigation items are left untouched):
 *   R    the fix patch's viewDidAppear re-sync (w/h = hidden before/after)
 *   S/H  react-native-screens shows/hides the bar (screen, caller wS/iN,
 *        a=animated, t=in transition, w=hidden before, h=hidden after)
 *   V    scan of every UINavigationBar actually visible in the window:
 *        own/OTHER (the stack's bar or another one), y, alpha, top item
 *        title, superview class. Taken at viewWillAppear (wA), at the start
 *        of the transition animation (an), +50/+150/+300 ms, and at
 *        viewDidAppear (dA). nh = navigationBarHidden of the stack.
 */
if (process.env.HAPPY_HEADER_DIAG !== '1') return;

const fs = require('fs');
const path = require('path');

const nodeModulesRoots = [
    path.resolve(__dirname, '..', 'node_modules'),
    path.resolve(__dirname, '..', 'packages/happy-app/node_modules'),
];

const MARKER = 'happy-diag';

const edits = [
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `@implementation RNSScreenStackHeaderConfig {`,
        replace: `// ${MARKER}: navigation bar event log, shown in an overlay label.
static NSString *gHappyDiagCaller = nil;
static NSMutableArray<NSString *> *gHappyDiagEvents = nil;
static CFTimeInterval gHappyDiagStart = 0;

NSString *HappyDiagShortTitle(NSString *title)
{
  if (title == nil) {
    return @"nil";
  }
  return title.length > 4 ? [title substringToIndex:4] : title;
}

static UIWindow *HappyDiagKeyWindow(void)
{
  UIWindow *fallback = nil;
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:UIWindowScene.class]) {
      continue;
    }
    for (UIWindow *window in ((UIWindowScene *)scene).windows) {
      if (window.isKeyWindow) {
        return window;
      }
      if (fallback == nil && !window.hidden && window.windowLevel == UIWindowLevelNormal) {
        fallback = window;
      }
    }
  }
  if (fallback != nil) {
    return fallback;
  }
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  for (UIWindow *window in UIApplication.sharedApplication.windows) {
    if (!window.hidden) {
      return window;
    }
  }
#pragma clang diagnostic pop
  return UIApplication.sharedApplication.delegate.window;
}

static void HappyDiagUpdateOverlay(void)
{
  UIWindow *window = HappyDiagKeyWindow();
  if (window == nil) {
    return;
  }
  UILabel *label = (UILabel *)[window viewWithTag:0xD1A6];
  if (label == nil) {
    label = [UILabel new];
    label.tag = 0xD1A6;
    label.numberOfLines = 0;
    label.font = [UIFont monospacedSystemFontOfSize:8 weight:UIFontWeightRegular];
    label.textColor = UIColor.whiteColor;
    label.backgroundColor = [UIColor colorWithWhite:0 alpha:0.8];
    label.userInteractionEnabled = NO;
    [window addSubview:label];
  }
  label.text = [gHappyDiagEvents componentsJoinedByString:@"\\n"];
  CGFloat width = window.bounds.size.width - 16;
  CGSize size = [label sizeThatFits:CGSizeMake(width, CGFLOAT_MAX)];
  label.frame = CGRectMake(8, window.bounds.size.height * 0.30, width, size.height);
  [window bringSubviewToFront:label];
}

NSString *HappyDiagLogEvent(NSString *event)
{
  if (gHappyDiagEvents == nil) {
    gHappyDiagEvents = [NSMutableArray new];
    gHappyDiagStart = CACurrentMediaTime();
  }
  int ms = (int)((CACurrentMediaTime() - gHappyDiagStart) * 1000) % 100000;
  [gHappyDiagEvents addObject:[NSString stringWithFormat:@"%05d %@", ms, event]];
  while (gHappyDiagEvents.count > 14) {
    [gHappyDiagEvents removeObjectAtIndex:0];
  }
  HappyDiagUpdateOverlay();
  return event;
}

static BOOL HappyDiagIsVisible(UIView *view)
{
  for (UIView *v = view; v != nil; v = v.superview) {
    if (v.hidden || v.alpha < 0.01) {
      return NO;
    }
  }
  return view.window != nil;
}

static void HappyDiagCollectBars(UIView *view, NSMutableArray<UINavigationBar *> *bars)
{
  if ([view isKindOfClass:UINavigationBar.class]) {
    [bars addObject:(UINavigationBar *)view];
  }
  for (UIView *subview in view.subviews) {
    HappyDiagCollectBars(subview, bars);
  }
}

void HappyDiagScanBars(NSString *tag, UINavigationController *nav)
{
  UIWindow *window = HappyDiagKeyWindow();
  if (window == nil) {
    return;
  }
  NSMutableArray<UINavigationBar *> *bars = [NSMutableArray new];
  HappyDiagCollectBars(window, bars);
  NSMutableArray<NSString *> *visible = [NSMutableArray new];
  for (UINavigationBar *bar in bars) {
    if (!HappyDiagIsVisible(bar)) {
      continue;
    }
    CGRect frame = [bar convertRect:bar.bounds toView:window];
    NSString *superviewClass = NSStringFromClass(bar.superview.class);
    if (superviewClass.length > 12) {
      superviewClass = [superviewClass substringToIndex:12];
    }
    [visible addObject:[NSString stringWithFormat:@"%@ y%.0f a%.1f %@ %@",
                                                  bar == nav.navigationBar ? @"own" : @"OTHER",
                                                  frame.origin.y,
                                                  bar.alpha,
                                                  HappyDiagShortTitle(bar.topItem.title),
                                                  superviewClass]];
  }
  HappyDiagLogEvent([NSString stringWithFormat:@"V%@ nh%d %lu/%lu [%@]",
                                               tag,
                                               (int)nav.navigationBarHidden,
                                               (unsigned long)visible.count,
                                               (unsigned long)bars.count,
                                               [visible componentsJoinedByString:@"; "]]);
}

@implementation RNSScreenStackHeaderConfig {`,
    },
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `    [RNSScreenStackHeaderConfig updateViewController:self.screenView.controller withConfig:self animated:YES];`,
        replace: `    gHappyDiagCaller = @"iN"; // ${MARKER}
    [RNSScreenStackHeaderConfig updateViewController:self.screenView.controller withConfig:self animated:YES];`,
    },
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `  [self updateViewController:vc withConfig:config animated:animated];
  // As the header might have change in \`updateViewController\``,
        replace: `  gHappyDiagCaller = @"wS"; // ${MARKER}
  [self updateViewController:vc withConfig:config animated:animated];
  // As the header might have change in \`updateViewController\``,
    },
    {
        // The fix patch's guarded hide.
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `    if (!wasHidden) {
      [navctr setNavigationBarHidden:YES animated:animated && navctr.transitionCoordinator == nil];
    }
    return;
  }`,
        replace: `    if (!wasHidden) {
      [navctr setNavigationBarHidden:YES animated:animated && navctr.transitionCoordinator == nil];
    }
    // ${MARKER}
    HappyDiagLogEvent([NSString stringWithFormat:@"H %@ %@ a%d t%d w%d>h%d n%lu",
                                                 HappyDiagShortTitle(config.title),
                                                 gHappyDiagCaller ?: @"?",
                                                 (int)animated,
                                                 (int)(navctr.transitionCoordinator != nil),
                                                 (int)wasHidden,
                                                 (int)navctr.navigationBarHidden,
                                                 (unsigned long)navctr.viewControllers.count]);
    return;
  }`,
    },
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `  RCTAssert(shouldHide == NO, @"[RNScreens] RNSScreenStackHeaderConfig: expected shouldHide to be NO.");
  [navctr setNavigationBarHidden:NO animated:animated];`,
        replace: `  RCTAssert(shouldHide == NO, @"[RNScreens] RNSScreenStackHeaderConfig: expected shouldHide to be NO.");
  [navctr setNavigationBarHidden:NO animated:animated];
  // ${MARKER}
  HappyDiagLogEvent([NSString stringWithFormat:@"S %@ %@ a%d t%d w%d>h%d top%d",
                                               HappyDiagShortTitle(config.title),
                                               gHappyDiagCaller ?: @"?",
                                               (int)animated,
                                               (int)(navctr.transitionCoordinator != nil),
                                               (int)wasHidden,
                                               (int)navctr.navigationBarHidden,
                                               (int)(vc == navctr.topViewController)]);`,
    },
    {
        file: 'react-native-screens/ios/RNSScreen.mm',
        find: `#import "RNSScreenStackHeaderConfig.h"`,
        replace: `#import "RNSScreenStackHeaderConfig.h"

// ${MARKER}: defined in RNSScreenStackHeaderConfig.mm.
NSString *HappyDiagShortTitle(NSString *title);
NSString *HappyDiagLogEvent(NSString *event);
void HappyDiagScanBars(NSString *tag, UINavigationController *nav);`,
    },
    {
        file: 'react-native-screens/ios/RNSScreen.mm',
        find: `- (void)viewWillAppear:(BOOL)animated
{
  [super viewWillAppear:animated];`,
        replace: `- (void)viewWillAppear:(BOOL)animated
{
  [super viewWillAppear:animated];
  // ${MARKER}: sample the visible navigation bars through the transition.
  if (self.navigationController != nil) {
    UINavigationController *happyNav = self.navigationController;
    NSString *happyTitle = HappyDiagShortTitle([self.screenView findHeaderConfig].title);
    HappyDiagScanBars([NSString stringWithFormat:@"wA %@", happyTitle], happyNav);
    [self.transitionCoordinator
        animateAlongsideTransition:^(id<UIViewControllerTransitionCoordinatorContext> context) {
          HappyDiagScanBars([NSString stringWithFormat:@"an %@", happyTitle], happyNav);
        }
                        completion:nil];
    for (NSNumber *delay in @[ @50, @150, @300 ]) {
      dispatch_after(
          dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay.intValue * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
            HappyDiagScanBars([NSString stringWithFormat:@"+%@ %@", delay, happyTitle], happyNav);
          });
    }
  }`,
    },
    {
        file: 'react-native-screens/ios/RNSScreen.mm',
        find: `  [super viewDidAppear:animated];`,
        replace: `  [super viewDidAppear:animated];
  // ${MARKER}
  if (self.navigationController != nil) {
    HappyDiagScanBars([NSString stringWithFormat:@"dA %@", HappyDiagShortTitle([self.screenView findHeaderConfig].title)],
                      self.navigationController);
  }`,
    },
    {
        // The fix patch's viewDidAppear re-sync.
        file: 'react-native-screens/ios/RNSScreen.mm',
        find: `    [RNSScreenStackHeaderConfig willShowViewController:self animated:NO withConfig:[self.screenView findHeaderConfig]];
  }`,
        replace: `    BOOL happyDiagWasHidden = self.navigationController.navigationBarHidden; // ${MARKER}
    [RNSScreenStackHeaderConfig willShowViewController:self animated:NO withConfig:[self.screenView findHeaderConfig]];
    HappyDiagLogEvent([NSString stringWithFormat:@"R %@ t%d w%d>h%d",
                                                 HappyDiagShortTitle([self.screenView findHeaderConfig].title),
                                                 (int)(self.transitionCoordinator != nil),
                                                 (int)happyDiagWasHidden,
                                                 (int)self.navigationController.navigationBarHidden]);
  }`,
    },
];

let patched = 0;

for (const nodeModulesRoot of nodeModulesRoots) {
    const byFile = new Map();
    for (const edit of edits) {
        const file = path.join(nodeModulesRoot, edit.file);
        if (!fs.existsSync(file)) continue;
        if (!byFile.has(file)) byFile.set(file, []);
        byFile.get(file).push(edit);
    }

    for (const [file, fileEdits] of byFile) {
        let content = fs.readFileSync(file, 'utf8');
        const original = content;
        for (const edit of fileEdits) {
            if (content.includes(edit.replace)) continue;
            if (!content.includes(edit.find)) {
                throw new Error(`[patch] react-native-screens header diagnostics: anchor not found in ${file}`);
            }
            content = content.replace(edit.find, edit.replace);
        }
        if (content !== original) {
            fs.writeFileSync(file, content, 'utf8');
            patched++;
        }
    }
}

if (patched > 0) {
    console.log(`[patch] DIAG react-native-screens header diagnostics (${patched} file(s))`);
}
