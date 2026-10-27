/**
 * TEMPORARY native diagnostics for slopus/happy#1890. Applied only when
 * HAPPY_HEADER_DIAG=1 (the sideload IPA workflow), after
 * fix-react-native-screens-header-before-props.cjs.
 *
 * Keeps a log of the last 4 navigation-bar events and shows it, in a small
 * multi-line label, as the title of the navigation item it touches:
 *   S  config un-hides the bar        H  config hides the bar
 *   C  transition-completion re-hide   A  screen did appear
 * Each event: screen (first 4 chars of the config title), caller
 * (wS = willShowViewController, iN = updateViewControllerIfNeeded),
 * a = animated, t = push/pop transition in progress, w = bar hidden before,
 * h = bar hidden after. The viewDidAppear re-apply is disabled so the bar
 * stays up for a screenshot.
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
        replace: `// ${MARKER}: navigation bar event log.
static NSString *gHappyDiagCaller = nil;
static NSMutableArray<NSString *> *gHappyDiagEvents = nil;

NSString *HappyDiagShortTitle(NSString *title)
{
  if (title == nil) {
    return @"nil";
  }
  return title.length > 4 ? [title substringToIndex:4] : title;
}

NSString *HappyDiagLogEvent(NSString *event)
{
  if (gHappyDiagEvents == nil) {
    gHappyDiagEvents = [NSMutableArray new];
  }
  [gHappyDiagEvents addObject:event];
  while (gHappyDiagEvents.count > 4) {
    [gHappyDiagEvents removeObjectAtIndex:0];
  }
  return [gHappyDiagEvents componentsJoinedByString:@"\\n"];
}

void HappyDiagShowLog(UINavigationItem *item, NSString *log)
{
  UILabel *label = [UILabel new];
  label.text = log;
  label.numberOfLines = 4;
  label.font = [UIFont monospacedSystemFontOfSize:8 weight:UIFontWeightRegular];
  label.textColor = UIColor.systemRedColor;
  label.textAlignment = NSTextAlignmentLeft;
  [label sizeToFit];
  item.title = log;
  item.titleView = label;
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
        // The fix patch's transition-completion re-hide.
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `                                     if (!strongNav.navigationBarHidden) {
                                       [strongNav setNavigationBarHidden:YES animated:NO];
                                     }`,
        replace: `                                     BOOL happyDiagWasHidden = strongNav.navigationBarHidden; // ${MARKER}
                                     if (!strongNav.navigationBarHidden) {
                                       [strongNav setNavigationBarHidden:YES animated:NO];
                                     }
                                     HappyDiagShowLog(
                                         weakVC.navigationItem,
                                         HappyDiagLogEvent([NSString stringWithFormat:@"C %@ w%d>h%d",
                                                                                      HappyDiagShortTitle(strongConfig.title),
                                                                                      (int)happyDiagWasHidden,
                                                                                      (int)strongNav.navigationBarHidden]));`,
    },
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `    navitem.title = config.title;

    // Setting navigation bar visibility is split to mitigate iOS 26 bug with bar button items.
    [navctr setNavigationBarHidden:YES animated:animated];
    return;
  }`,
        replace: `    navitem.title = config.title;

    // Setting navigation bar visibility is split to mitigate iOS 26 bug with bar button items.
    [navctr setNavigationBarHidden:YES animated:animated];
    // ${MARKER}
    HappyDiagShowLog(
        navitem,
        HappyDiagLogEvent([NSString stringWithFormat:@"H %@ %@ a%d t%d w%d>h%d n%lu",
                                                     HappyDiagShortTitle(config.title),
                                                     gHappyDiagCaller ?: @"?",
                                                     (int)animated,
                                                     (int)(navctr.transitionCoordinator != nil),
                                                     (int)wasHidden,
                                                     (int)navctr.navigationBarHidden,
                                                     (unsigned long)navctr.viewControllers.count]));
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
  HappyDiagShowLog(
      navitem,
      HappyDiagLogEvent([NSString stringWithFormat:@"S %@ %@ a%d t%d w%d>h%d top%d",
                                                   HappyDiagShortTitle(config.title),
                                                   gHappyDiagCaller ?: @"?",
                                                   (int)animated,
                                                   (int)(navctr.transitionCoordinator != nil),
                                                   (int)wasHidden,
                                                   (int)navctr.navigationBarHidden,
                                                   (int)(vc == navctr.topViewController)]));`,
    },
    {
        // Replace the fix patch's viewDidAppear re-apply with an appear event.
        file: 'react-native-screens/ios/RNSScreen.mm',
        find: `  if (self.navigationController != nil && self.navigationController.topViewController == self) {
    [RNSScreenStackHeaderConfig willShowViewController:self animated:NO withConfig:[self.screenView findHeaderConfig]];
  }
`,
        replace: `  // ${MARKER}: viewDidAppear header re-apply disabled for diagnostics.
  if (self.navigationController != nil) {
    HappyDiagShowLog(
        self.navigationItem,
        HappyDiagLogEvent([NSString stringWithFormat:@"A %@ top%d h%d",
                                                     HappyDiagShortTitle([self.screenView findHeaderConfig].title),
                                                     (int)(self.navigationController.topViewController == self),
                                                     (int)self.navigationController.navigationBarHidden]));
  }
`,
    },
    {
        file: 'react-native-screens/ios/RNSScreen.mm',
        find: `#import "RNSScreenStackHeaderConfig.h"`,
        replace: `#import "RNSScreenStackHeaderConfig.h"

// ${MARKER}: defined in RNSScreenStackHeaderConfig.mm.
NSString *HappyDiagShortTitle(NSString *title);
NSString *HappyDiagLogEvent(NSString *event);
void HappyDiagShowLog(UINavigationItem *item, NSString *log);`,
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
