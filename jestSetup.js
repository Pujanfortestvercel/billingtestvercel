jest.mock('react-native-config', () => ({
  SUPABASE_URL: 'https://test-supabase-project.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key-here-for-jest-mocking-value',
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  multiMerge: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-print', () => ({
  default: {
    print: jest.fn(),
    selectPrinter: jest.fn(),
  },
}));

jest.mock('react-native-share', () => ({
  default: {
    open: jest.fn(),
    shareSingle: jest.fn(),
  },
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
