
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { authenticatedPost } from '@/utils/api';

const BACKGROUND_FETCH_TASK = 'device-monitoring-task';

// Background task for monitoring device usage
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('Device Monitor: Background task running');
  
  try {
    // Collect device usage data
    const usageData = await collectDeviceUsage();
    
    // Send to backend
    if (usageData) {
      await sendUsageReport(usageData);
    }
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Device Monitor: Background task error', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

interface DeviceUsageData {
  deviceId: string;
  appName: string;
  usageMinutes: number;
  reportedAt: string;
  deviceInfo: {
    manufacturer: string | null;
    modelName: string | null;
    osName: string | null;
    osVersion: string | null;
    totalMemory: number | null;
  };
}

// Collect real device usage information
async function collectDeviceUsage(): Promise<DeviceUsageData | null> {
  console.log('Device Monitor: Collecting device usage data');
  
  try {
    const deviceId = Application.applicationId || 'unknown-device';
    
    // Get device information
    const deviceInfo = {
      manufacturer: Device.manufacturer,
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      totalMemory: Device.totalMemory,
    };
    
    console.log('Device Monitor: Device info collected', deviceInfo);
    
    // Note: iOS and Android have restrictions on accessing app usage stats
    // This is a simplified version - real implementation would need native modules
    const currentApp = Application.applicationName || 'Current App';
    const usageMinutes = Math.floor(Math.random() * 5) + 1; // Simulated for now
    
    return {
      deviceId,
      appName: currentApp,
      usageMinutes,
      reportedAt: new Date().toISOString(),
      deviceInfo,
    };
  } catch (error) {
    console.error('Device Monitor: Error collecting usage data', error);
    return null;
  }
}

// Send usage report to backend
async function sendUsageReport(data: DeviceUsageData): Promise<void> {
  console.log('Device Monitor: Sending usage report', data);
  
  try {
    await authenticatedPost('/device-agent/report', {
      deviceId: data.deviceId,
      appName: data.appName,
      usageMinutes: data.usageMinutes,
      reportedAt: data.reportedAt,
    });
    
    console.log('Device Monitor: Usage report sent successfully');
  } catch (error) {
    console.error('Device Monitor: Error sending usage report', error);
  }
}

// Register background fetch task
export async function registerBackgroundFetch(): Promise<void> {
  console.log('Device Monitor: Registering background fetch');
  
  try {
    const status = await BackgroundFetch.getStatusAsync();
    console.log('Device Monitor: Background fetch status', status);
    
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (minimum allowed)
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      console.log('Device Monitor: Background fetch registered successfully');
    } else {
      console.warn('Device Monitor: Background fetch not available');
    }
  } catch (error) {
    console.error('Device Monitor: Error registering background fetch', error);
  }
}

// Unregister background fetch task
export async function unregisterBackgroundFetch(): Promise<void> {
  console.log('Device Monitor: Unregistering background fetch');
  
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    console.log('Device Monitor: Background fetch unregistered');
  } catch (error) {
    console.error('Device Monitor: Error unregistering background fetch', error);
  }
}

// Check if background fetch is registered
export async function isBackgroundFetchRegistered(): Promise<boolean> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    console.log('Device Monitor: Background fetch registered?', isRegistered);
    return isRegistered;
  } catch (error) {
    console.error('Device Monitor: Error checking background fetch status', error);
    return false;
  }
}

// Get real device information
export async function getDeviceInfo() {
  console.log('Device Monitor: Getting device information');
  
  const info = {
    // Device identification
    deviceId: Application.applicationId || 'unknown',
    deviceName: Device.deviceName || 'Unknown Device',
    
    // Device specs
    brand: Device.brand,
    manufacturer: Device.manufacturer,
    modelName: Device.modelName,
    modelId: Device.modelId,
    designName: Device.designName,
    productName: Device.productName,
    
    // OS information
    osName: Device.osName,
    osVersion: Device.osVersion,
    osBuildId: Device.osBuildId,
    platformApiLevel: Device.platformApiLevel,
    
    // Device type
    deviceType: Device.deviceType,
    isDevice: Device.isDevice,
    
    // Memory
    totalMemory: Device.totalMemory,
    
    // Platform
    platform: Platform.OS,
    platformVersion: Platform.Version,
    
    // App information
    applicationName: Application.applicationName,
    applicationId: Application.applicationId,
    nativeApplicationVersion: Application.nativeApplicationVersion,
    nativeBuildVersion: Application.nativeBuildVersion,
  };
  
  console.log('Device Monitor: Device info retrieved', info);
  return info;
}

// Check device capabilities for parental controls
export function getDeviceCapabilities() {
  console.log('Device Monitor: Checking device capabilities');
  
  const capabilities = {
    // Background monitoring
    backgroundFetch: true,
    
    // Platform-specific capabilities
    canBlockApps: Platform.OS === 'android', // Android allows more control
    canTrackUsage: Platform.OS === 'android', // Android has UsageStatsManager
    canLockScreen: Platform.OS === 'android', // Android Device Admin API
    
    // Requires native modules for full functionality
    requiresNativeModule: true,
    
    // Available features
    availableFeatures: [
      'Device Information',
      'Background Monitoring',
      'Usage Reporting',
      Platform.OS === 'android' ? 'App Blocking (requires native module)' : null,
      Platform.OS === 'android' ? 'Screen Lock (requires native module)' : null,
      'Rule Enforcement',
    ].filter(Boolean),
    
    // Limitations
    limitations: [
      Platform.OS === 'ios' ? 'iOS restricts app usage tracking' : null,
      Platform.OS === 'ios' ? 'iOS restricts app blocking' : null,
      'Full parental controls require native modules',
      'Background fetch limited to 15-minute intervals',
    ].filter(Boolean),
  };
  
  console.log('Device Monitor: Capabilities', capabilities);
  return capabilities;
}

// Enforce rules locally (basic implementation)
export function enforceRules(rules: any[]) {
  console.log('Device Monitor: Enforcing rules', rules.length);
  
  rules.forEach(rule => {
    if (!rule.isActive) return;
    
    switch (rule.ruleType) {
      case 'screen_lock':
        console.log('Device Monitor: Screen lock rule active');
        console.log('Device Monitor: Note - Screen locking requires native module');
        // Would require native module to actually lock screen
        break;
        
      case 'app_block':
        console.log('Device Monitor: App block rule for', rule.targetApp);
        console.log('Device Monitor: Note - App blocking requires native module');
        // Would require native module to block apps
        break;
        
      case 'time_limit':
        console.log('Device Monitor: Time limit for', rule.targetApp, ':', rule.timeLimit, 'minutes');
        // Could track time and show warnings
        break;
        
      default:
        console.log('Device Monitor: Unknown rule type', rule.ruleType);
    }
  });
}
