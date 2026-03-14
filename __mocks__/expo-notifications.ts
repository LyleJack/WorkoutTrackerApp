export default {};
export const setNotificationHandler = jest.fn();
export const scheduleNotificationAsync = jest.fn(async () => 'mock-notif-id');
export const cancelScheduledNotificationAsync = jest.fn(async () => {});
export const requestPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));
export const SchedulableTriggerInputTypes = { DAILY: 'daily' };
