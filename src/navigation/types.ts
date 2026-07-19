// Route names + the params each screen accepts. Gives us type-safe navigation
// (auto-complete for navigation.navigate(...) and route.params).
import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type AppTabsParamList = {
  Dashboard: undefined;
  Customers: undefined;
  Items: undefined;
  // Billing can be opened fresh (undefined) or to EDIT an existing bill (billId).
  Billing: { billId?: string } | undefined;
  History: undefined;
};

// The stack that hosts the bottom tabs plus the pushed screens (Settings,
// Inventory) that are reached from the Dashboard rather than the tab bar.
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<AppTabsParamList> | undefined;
  Settings: undefined;
  Inventory: undefined;
};

export type AdminStackParamList = {
  Admin: undefined;
};
