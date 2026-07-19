// The shell for a logged-in business user: the bottom tabs plus the screens
// that are pushed on top of them (Settings, Inventory) and reached from the
// Dashboard rather than living in the tab bar.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types';
import { AppTabs } from './AppTabs';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { InventoryScreen } from '../screens/inventory/InventoryScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={AppTabs} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Inventory" component={InventoryScreen} />
    </Stack.Navigator>
  );
}
