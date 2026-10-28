/**
 * Expo's SwiftUI views (`@expo/ui/swift-ui`: the composer's model/mode pickers,
 * the home dock) are hosted by expo-modules-core's SwiftUIHostingView in a
 * UIHostingController added as a child of the react-native-screens screen.
 * Inside a UINavigationController, UIHostingController applies SwiftUI's
 * navigation bar visibility (shown by default) and on iOS 15 calls
 * setNavigationBarHidden:NO on the enclosing stack. Screens with
 * `headerShown: false` then show UIKit's bar ("session/[id]" and "Back" under
 * the app's own header, slopus/happy#1890). Measured on iOS 15.6.1: the call
 * comes from SwiftUI inside -[UINavigationController setNavigationBarHidden:animated:].
 *
 * An embedded SwiftUI component must not manage the screen's navigation bar:
 * host it in a UIHostingController that reports no navigation controller.
 */
const fs = require('fs');
const path = require('path');

const nodeModulesRoots = [
    path.resolve(__dirname, '..', 'node_modules'),
    path.resolve(__dirname, '..', 'packages/happy-app/node_modules'),
];

const MARKER = 'happy: embedded hosting controller';

const edits = [
    {
        file: 'expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift',
        find: `      let controller = UIHostingController(rootView: rootView)`,
        replace: `      #if os(iOS) || os(tvOS)
      // ${MARKER}: see EmbeddedHostingController.
      let controller: UIHostingController<AnyView> = EmbeddedHostingController(rootView: rootView)
      #else
      let controller = UIHostingController(rootView: rootView)
      #endif`,
    },
    {
        file: 'expo-modules-core/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift',
        find: `extension UIHostingController {`,
        replace: `#if os(iOS) || os(tvOS)
/**
 ${MARKER}: an embedded SwiftUI view must not manage the screen's
 navigation bar. Inside a UINavigationController, UIHostingController applies
 SwiftUI's bar visibility (shown by default) and on iOS 15 un-hides the bar of a
 screen that has none.
 */
private final class EmbeddedHostingController: UIHostingController<AnyView> {
  override var navigationController: UINavigationController? {
    return nil
  }
}
#endif

extension UIHostingController {`,
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
            if (!content.includes(edit.find)) {
                throw new Error(`[patch] expo-modules-core hosting controller patch: anchor not found in ${file}`);
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
    console.log('[patch] expo-modules-core not installed, hosting controller patch skipped');
} else if (patched > 0) {
    console.log(`[patch] Fixed expo-modules-core SwiftUI views showing the navigation bar (${patched} file(s))`);
}
