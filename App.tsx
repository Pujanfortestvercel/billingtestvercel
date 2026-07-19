/**
 * App.tsx — the ROOT of the app.
 * It wires up the "providers" (shared state) and the navigation system:
 *
 *   SafeAreaProvider     → keeps content away from notches/home bar
 *     AuthProvider       → who is logged in + their role
 *       Root             → decides: not configured? loading? else show the app
 *         NavigationContainer → required wrapper for all navigation
 *           RootNavigator     → Auth screens / Admin page / Billing tabs
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { NotConfiguredScreen } from './src/screens/NotConfiguredScreen';
import { Loading } from './src/components/common/Loading';
import { isSupabaseConfigured } from './src/config/supabase';
import { colors } from './src/theme';

function Root() {
  const { initializing } = useAuth();

  // Until you paste your Supabase keys, show setup instructions.
  if (!isSupabaseConfigured) return <NotConfiguredScreen />;
  // While checking for a saved login, show a spinner.
  if (initializing) return <Loading text="Starting up…" />;

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
