/**
 * Keeps the native navigation bar hidden for screens with `headerShown: false`
 * on iOS 15 (slopus/happy#1890): the session screen otherwise shows UIKit's bar
 * with the route name ("session/[id]") and "Back" under the app's glass header.
 *
 * react-native-screens 4.22 hides the bar from UIKit's
 * `navigationController:willShowViewController:animated:` with
 * `setNavigationBarHidden:YES animated:YES`. On iOS 15 UINavigationController
 * accepts that, then restores the bar state it captured when the push/pop
 * started once the transition completes. Every back navigation therefore
 * leaves the (transparent, empty) bar visible on home, and the next push
 * shows it with the pushed screen's navigation item.
 *
 * 1. When the bar is hidden during a transition, hide it again (without
 *    animation) when that transition completes, if the screen is still on top
 *    and still wants no header.
 * 2. Re-apply the top screen's header config when it appears, as a safety net.
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
        find: `  if (shouldHide) {
    navitem.title = config.title;
`,
        replace: `  if (shouldHide) {
    // ${MARKER}: iOS 15 restores the bar state captured at the start of a
    // push/pop when the transition completes, undoing the hide below.
    id<UIViewControllerTransitionCoordinator> coordinator = navctr.transitionCoordinator;
    if (coordinator != nil) {
      __weak UINavigationController *weakNav = navctr;
      __weak UIViewController *weakVC = vc;
      __weak RNSScreenStackHeaderConfig *weakConfig = config;
      [coordinator animateAlongsideTransition:nil
                                   completion:^(id<UIViewControllerTransitionCoordinatorContext> context) {
                                     UINavigationController *strongNav = weakNav;
                                     if (context.isCancelled || strongNav == nil ||
                                         strongNav.topViewController != weakVC) {
                                       return;
                                     }
                                     RNSScreenStackHeaderConfig *strongConfig = weakConfig;
                                     if (strongConfig != nil && strongConfig.shouldHeaderBeVisible) {
                                       return;
                                     }
                                     if (!strongNav.navigationBarHidden) {
                                       [strongNav setNavigationBarHidden:YES animated:NO];
                                     }
                                   }];
    }

    navitem.title = config.title;
`,
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
    console.log(`[patch] Fixed react-native-screens bar reappearing after transitions (${patched} file(s))`);
}
