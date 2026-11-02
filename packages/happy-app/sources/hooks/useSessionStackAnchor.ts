import * as React from 'react';
import { Platform } from 'react-native';
import { CommonActions, useFocusEffect, useNavigation, type ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const HOME_ROUTE = 'index';
/** Longer than the native push, for chats that appear without one (cold start). */
const FALLBACK_DELAY_MS = 700;

/**
 * Keeps a chat directly above the home list in the native stack, so the iOS
 * back swipe (and the back button) from a chat always lands on the main list,
 * whatever it was opened from: another chat, settings, inbox, a notification.
 * Screens pushed on top of the chat (info, files, a message) are untouched; the
 * screens below it are dropped once the chat has finished appearing.
 *
 * Uses react-navigation's reset because expo-router has no API that rewrites
 * the routes under the focused screen. Web keeps a single session route already.
 */
export function useSessionStackAnchor() {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

    const anchor = React.useCallback(() => {
        const state = navigation.getState();
        if (!state || state.type !== 'stack' || !navigation.isFocused()) return;
        const current = state.routes[state.index];
        if (state.index !== state.routes.length - 1) return;
        if (state.routes.length === 2 && state.routes[0].name === HOME_ROUTE) return;
        const home = state.routes.find(route => route.name === HOME_ROUTE) ?? { name: HOME_ROUTE };
        navigation.dispatch(CommonActions.reset({
            ...state,
            index: 1,
            routes: [home, current],
        }));
    }, [navigation]);

    React.useEffect(() => {
        if (Platform.OS === 'web') return;
        return navigation.addListener('transitionEnd', (event) => {
            if (!event.data.closing) anchor();
        });
    }, [anchor, navigation]);

    useFocusEffect(React.useCallback(() => {
        if (Platform.OS === 'web') return;
        const timer = setTimeout(anchor, FALLBACK_DELAY_MS);
        return () => clearTimeout(timer);
    }, [anchor]));
}
