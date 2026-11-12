import * as Notifications from 'expo-notifications';

export function initNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

export async function registerDailyPeakAlerts(): Promise<void> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    // 7:55 AM Peak alert (Monday - Saturday)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚡ Meralco Peak Hours Alert',
        body: 'Magsisimula na ang Peak Hours (8 AM – 9 PM). Ipagpaliban ang paggamit ng plantsa o washing machine para makatipid.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 7,
        minute: 55,
        repeats: true,
      },
    });

    // 9:00 PM Off-Peak alert
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌙 Off-Peak Hours Na!',
        body: 'Mababang demand period na hanggang 8:00 AM bukas. Pwede nang gamitin ang high-wattage appliances.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 21,
        minute: 0,
        repeats: true,
      },
    });
  } catch {
    // Non-blocking catch
  }
}

export async function scheduleApplianceDelayReminder(
  applianceName: string,
  delayMinutes: number
): Promise<string> {
  try {
    await requestNotificationPermissions();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Appliance Reminder: ${applianceName}`,
        body: `Tapos na ang ${delayMinutes} minutong palugit. Ligtas at mas matipid nang gamitin ang iyong ${applianceName}!`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, delayMinutes * 60),
      },
    });
    return id;
  } catch {
    return '';
  }
}
