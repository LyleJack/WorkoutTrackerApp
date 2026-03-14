export const Platform  = { OS: 'android', select: (obj: any) => obj.android ?? obj.default };
export const Dimensions = { get: () => ({ width: 390, height: 844 }) };
export const Alert     = { alert: jest.fn() };
export const AppState  = { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) };
export const Animated  = { Value: jest.fn(), timing: jest.fn(), sequence: jest.fn(), delay: jest.fn(), spring: jest.fn() };
export const StyleSheet = { create: (s: any) => s, flatten: (s: any) => s };
// Components that tests don't render
export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const ScrollView = 'ScrollView';
export const Modal = 'Modal';
export const FlatList = 'FlatList';
export const TextInput = 'TextInput';
export const Switch = 'Switch';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';
export const Vibration = { vibrate: jest.fn() };
export const useColorScheme = jest.fn(() => 'dark');
