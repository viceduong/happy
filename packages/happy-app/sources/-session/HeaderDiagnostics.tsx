import * as React from 'react';
import { Platform, Text, View } from 'react-native';
import { HeaderHeightContext, HeaderShownContext } from '@react-navigation/elements';
import { useNavigation, useRoute } from '@react-navigation/native';

/**
 * TEMPORARY diagnostics for slopus/happy#1890 ("session/[id]" native header
 * shows under the glass header). Only rendered when the build sets
 * EXPO_PUBLIC_HEADER_DIAG=1 (the sideload IPA workflow).
 *
 * native-stack provides HeaderHeightContext as `headerShown !== false ?
 * headerHeight : parentHeaderHeight ?? 0`, so a non-zero value here means the
 * JS options for this route say the native header is shown.
 */
export const HEADER_DIAGNOSTICS_ENABLED = process.env.EXPO_PUBLIC_HEADER_DIAG === '1';

export const HeaderDiagnostics = React.memo(() => {
    const headerHeight = React.useContext(HeaderHeightContext);
    const parentHeaderShown = React.useContext(HeaderShownContext);
    const route = useRoute();
    const navigation = useNavigation();
    const [, forceRender] = React.useReducer((n: number) => n + 1, 0);

    // Re-read the navigator state after the push settles.
    React.useEffect(() => {
        const timers = [250, 1000, 3000].map((ms) => setTimeout(forceRender, ms));
        return () => timers.forEach(clearTimeout);
    }, []);

    const state = navigation.getState() as any;
    const routes = (state?.routes ?? []).map((r: any) => r.name).join(' > ');
    const preloaded = (state?.preloadedRoutes ?? []).map((r: any) => r.name).join(', ') || '-';
    const parentState = navigation.getParent()?.getState() as any;

    const lines = [
        `iOS ${String(Platform.Version)} | route ${route.name} | key ${route.key.slice(-6)}`,
        `HeaderHeightContext=${String(headerHeight)} HeaderShownContext(parent)=${String(parentHeaderShown)}`,
        `stack(${state?.type}) idx=${state?.index}/${(state?.routes?.length ?? 0) - 1}: ${routes}`,
        `preloaded: ${preloaded}`,
        `parent(${parentState?.type ?? '-'}): ${(parentState?.routes ?? []).map((r: any) => r.name).join(' > ') || '-'}`,
    ];

    return (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute',
                left: 8,
                right: 8,
                bottom: 140,
                zIndex: 2000,
                padding: 6,
                borderRadius: 6,
                backgroundColor: 'rgba(160, 0, 0, 0.85)',
            }}
        >
            {lines.map((line) => (
                <Text key={line} style={{ color: 'white', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                    {line}
                </Text>
            ))}
        </View>
    );
});
