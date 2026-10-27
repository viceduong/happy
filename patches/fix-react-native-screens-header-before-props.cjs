/**
 * react-native-screens 4.22 (Fabric) can show the native navigation bar on a
 * screen whose header is hidden (`headerShown: false`), e.g. the session
 * screen on iOS 15, where UIKit's bar with the route name ("session/[id]")
 * ends up under the app's own glass header (slopus/happy#1890).
 *
 * RNSScreenStackHeaderConfig starts with `_show = YES` until Fabric delivers
 * its props. When UIKit's push callback (`willShowViewController`) applies the
 * config before that, the placeholder `show` un-hides the bar.
 *
 * 1. Never apply a header config that has not received its first props; the
 *    bar keeps its current state until the real props arrive.
 * 2. Mark the props as set before `updateProps` applies them, so that first
 *    real update is not skipped by (1).
 * 3. Re-apply the top screen's header config when it appears, so no stale
 *    bar state can outlive a transition.
 */
const fs = require('fs');
const path = require('path');

const nodeModulesRoots = [
    path.resolve(__dirname, '..', 'node_modules'),
    path.resolve(__dirname, '..', 'packages/happy-app/node_modules'),
];

const MARKER = 'happy: header-before-props';

const edits = [
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `  if (navctr == nil) {
    return;
  }

  NSUInteger currentIndex = [navctr.viewControllers indexOfObject:vc];`,
        replace: `  if (navctr == nil) {
    return;
  }

#ifdef RCT_NEW_ARCH_ENABLED
  // ${MARKER}: \`show\` is only a placeholder until the first props arrive;
  // applying it here would un-hide the bar for a headerShown: false screen.
  if (config != nil && !config->_initialPropsSet) {
    return;
  }
#endif

  NSUInteger currentIndex = [navctr.viewControllers indexOfObject:vc];`,
    },
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `  [self updateViewControllerIfNeeded];

  if (needsNavigationControllerLayout) {
    [self layoutNavigationControllerView];
  }`,
        replace: `  // ${MARKER}: the props are set from here on, so this update must apply.
  _initialPropsSet = YES;
  [self updateViewControllerIfNeeded];

  if (needsNavigationControllerLayout) {
    [self layoutNavigationControllerView];
  }`,
    },
    {
        file: 'react-native-screens/ios/RNSScreen.mm',
        find: `  [super viewDidAppear:animated];
  if (!_isSwiping || _shouldNotify) {`,
        replace: `  [super viewDidAppear:animated];
  // ${MARKER}: the screen on top owns the bar; re-apply its final config.
  if (self.navigationController != nil && self.navigationController.topViewController == self) {
    [RNSScreenStackHeaderConfig willShowViewController:self animated:NO withConfig:[self.screenView findHeaderConfig]];
  }
  if (!_isSwiping || _shouldNotify) {`,
    },
];

let patched = 0;
let found = 0;

for (const nodeModulesRoot of nodeModulesRoots) {
    const byFile = new Map();
    for (const edit of edits) {
        const file = path.join(nodeModulesRoot, edit.file);
        if (!fs.existsSync(file)) continue;
        if (!byFile.has(file)) byFile.set(file, []);
        byFile.get(file).push(edit);
    }

    for (const [file, fileEdits] of byFile) {
        found++;
        let content = fs.readFileSync(file, 'utf8');
        const original = content;
        for (const edit of fileEdits) {
            if (content.includes(edit.replace)) continue;
            // Already patched, then rewritten by the temporary diagnostics patch.
            if (content.includes('happy-diag')) continue;
            if (!content.includes(edit.find)) {
                throw new Error(`[patch] react-native-screens header patch: anchor not found in ${file}`);
            }
            content = content.replace(edit.find, edit.replace);
        }
        if (content !== original) {
            fs.writeFileSync(file, content, 'utf8');
            patched++;
        }
    }
}

if (found === 0) {
    console.log('[patch] react-native-screens not installed, header patch skipped');
} else if (patched > 0) {
    console.log(`[patch] Fixed react-native-screens header shown before props (${patched} file(s))`);
}
