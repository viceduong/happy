/**
 * TEMPORARY native diagnostics for slopus/happy#1890. Applied only when
 * HAPPY_HEADER_DIAG=1 (the sideload IPA workflow), after
 * fix-react-native-screens-header-before-props.cjs.
 *
 * Whenever react-native-screens un-hides the navigation bar, the bar's title
 * is replaced with what did it: the config's own title (which screen), its
 * show/props state, whether that controller is on top, and the caller. The
 * viewDidAppear re-apply is removed so the bar stays up for a screenshot.
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
        replace: `// ${MARKER}: last caller of updateViewController.
static NSString *gHappyDiagCaller = nil;

@implementation RNSScreenStackHeaderConfig {`,
    },
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `    [RNSScreenStackHeaderConfig updateViewController:self.screenView.controller withConfig:self animated:YES];`,
        replace: `    gHappyDiagCaller = @"ifNeeded"; // ${MARKER}
    [RNSScreenStackHeaderConfig updateViewController:self.screenView.controller withConfig:self animated:YES];`,
    },
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `  [self updateViewController:vc withConfig:config animated:animated];
  // As the header might have change in \`updateViewController\``,
        replace: `  gHappyDiagCaller = @"willShow"; // ${MARKER}
  [self updateViewController:vc withConfig:config animated:animated];
  // As the header might have change in \`updateViewController\``,
    },
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `  RCTAssert(shouldHide == NO, @"[RNScreens] RNSScreenStackHeaderConfig: expected shouldHide to be NO.");
  [navctr setNavigationBarHidden:NO animated:animated];`,
        replace: `  RCTAssert(shouldHide == NO, @"[RNScreens] RNSScreenStackHeaderConfig: expected shouldHide to be NO.");
  // ${MARKER}: name whoever un-hides the bar, in the bar itself.
  navitem.title = [NSString stringWithFormat:@"SHOW %@ by %@ show=%d props=%d top=%d n=%lu",
                                             config.title ?: @"nil",
                                             gHappyDiagCaller ?: @"?",
                                             (int)config.shouldHeaderBeVisible,
#ifdef RCT_NEW_ARCH_ENABLED
                                             (int)config->_initialPropsSet,
#else
                                             -1,
#endif
                                             (int)(vc == navctr.topViewController),
                                             (unsigned long)navctr.viewControllers.count];
  navitem.titleView = nil;
  [navctr setNavigationBarHidden:NO animated:animated];`,
    },
    {
        // Drop the safety net so the bar stays up long enough to read.
        file: 'react-native-screens/ios/RNSScreen.mm',
        find: `  if (self.navigationController != nil && self.navigationController.topViewController == self) {
    [RNSScreenStackHeaderConfig willShowViewController:self animated:NO withConfig:[self.screenView findHeaderConfig]];
  }
`,
        replace: `  // ${MARKER}: viewDidAppear header re-apply disabled for diagnostics.
`,
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
