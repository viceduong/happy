/**
 * react-native-screens hides the navigation bar for a `headerShown: false`
 * screen from UIKit's `navigationController:willShowViewController:animated:`
 * with `setNavigationBarHidden:YES animated:YES`, even when the bar is already
 * hidden. On iOS 15 that redundant animated hide, issued while a push/pop is
 * being set up, makes UINavigationController show the bar when the transition
 * animation starts (measured on iOS 15.6.1: hidden at viewWillAppear, visible
 * in the first animation frame), so the session screen showed UIKit's bar with
 * "session/[id]" and "Back" under the app's own header (slopus/happy#1890).
 *
 * An animated hide of a visible bar inside a transition is likewise reverted
 * when the animation runs (measured: hidden after the call, visible again in
 * the first animation frame and afterwards). Non-animated hides stick.
 *
 * Any bar change made from that delegate callback is undone when the push/pop
 * animation starts: UIKit has captured the bar state by then (viewWillAppear:
 * runs first). Non-animated hides made after the transition stick.
 *
 * 1. Apply the screen's header visibility in viewWillAppear:, Apple's place
 *    for setNavigationBarHidden:animated:, before the transition captures it.
 * 2. In the delegate path, only hide a visible bar (so the change already made
 *    in viewWillAppear: is not redone), and not animated inside a transition.
 */
const fs = require('fs');
const path = require('path');

const nodeModulesRoots = [
    path.resolve(__dirname, '..', 'node_modules'),
    path.resolve(__dirname, '..', 'packages/happy-app/node_modules'),
];

const MARKER = 'happy: no redundant bar hide';

const edits = [
    {
        file: 'react-native-screens/ios/RNSScreenStackHeaderConfig.mm',
        find: `    // Setting navigation bar visibility is split to mitigate iOS 26 bug with bar button items.
    [navctr setNavigationBarHidden:YES animated:animated];
    return;
  }`,
        replace: `    // Setting navigation bar visibility is split to mitigate iOS 26 bug with bar button items.
    // ${MARKER}: on iOS 15 an animated hide issued inside a push/pop
    // is undone when the animation runs (a visible bar comes back, an already
    // hidden one is shown). Only hide a visible bar, and not animated while a
    // transition is in progress.
    if (!wasHidden) {
      [navctr setNavigationBarHidden:YES animated:animated && navctr.transitionCoordinator == nil];
    }
    return;
  }`,
    },
    {
        file: 'react-native-screens/ios/RNSScreen.mm',
        find: `- (void)viewWillAppear:(BOOL)animated
{
  [super viewWillAppear:animated];`,
        replace: `- (void)viewWillAppear:(BOOL)animated
{
  [super viewWillAppear:animated];
  // ${MARKER}: set the bar's visibility here, where UIKit expects it. On
  // iOS 15 a change made later, from navigationController:willShowViewController:,
  // is undone when the push/pop animation starts.
  if (self.navigationController != nil && self.navigationController.topViewController == self) {
    [RNSScreenStackHeaderConfig willShowViewController:self animated:animated withConfig:[self.screenView findHeaderConfig]];
  }`,
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
            // Already patched, then extended by the temporary diagnostics patch.
            if (content.includes(MARKER)) continue;
            if (!content.includes(edit.find)) {
                throw new Error(`[patch] react-native-screens bar hide patch: anchor not found in ${file}`);
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
    console.log('[patch] react-native-screens not installed, bar hide patch skipped');
} else if (patched > 0) {
    console.log(`[patch] Fixed react-native-screens navigation bar hide in transitions (${patched} file(s))`);
}
