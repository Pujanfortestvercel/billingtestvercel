/**
 * @format
 */

// Polyfills required by Supabase to work in React Native.
// These MUST be the very first imports, before anything else loads.
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
