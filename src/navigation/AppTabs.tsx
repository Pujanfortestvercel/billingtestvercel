// The main app for normal users: a bottom tab bar with the 5 sections.
import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { AppTabsParamList } from './types';
import { colors } from '../theme';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { CustomersScreen } from '../screens/customers/CustomersScreen';
import { ItemsScreen } from '../screens/items/ItemsScreen';
import { BillingScreen } from '../screens/billing/BillingScreen';
import { HistoryScreen } from '../screens/history/HistoryScreen';

const Tab = createBottomTabNavigator<AppTabsParamList>();

// Emoji tab icons (avoids adding a native icon library).
const icon =
  (emoji: string) =>
  () =>
    <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: icon('🏠') }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomersScreen}
        options={{ tabBarIcon: icon('👥') }}
      />
      <Tab.Screen
        name="Items"
        component={ItemsScreen}
        options={{ tabBarIcon: icon('📦') }}
      />
      <Tab.Screen
        name="Billing"
        component={BillingScreen}
        options={{ tabBarIcon: icon('🧾') }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: icon('🗂️') }}
      />
    </Tab.Navigator>
  );
}
