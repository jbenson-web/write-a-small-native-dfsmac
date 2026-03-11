
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useColorScheme,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import * as Application from 'expo-application';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  registerBackgroundFetch,
  unregisterBackgroundFetch,
  isBackgroundFetchRegistered,
  getDeviceInfo,
  getDeviceCapabilities,
  enforceRules,
} from '@/services/DeviceMonitoringService';

interface DeviceRule {
  id: string;
  ruleType: 'screen_lock' | 'app_block' | 'time_limit';
  targetApp: string | null;
  timeLimit: number | null;
  isActive: boolean;
  createdAt: string;
}

interface UsageReport {
  appName: string;
  usageMinutes: number;
  lastReported: string;
}

interface DeviceInfoDisplay {
  deviceName: string;
  platform: string;
  osVersion: string;
  manufacturer: string;
  modelName: string;
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const router = useRouter();
  
  const [rules, setRules] = useState<DeviceRule[]>([]);
  const [usageData, setUsageData] = useState<UsageReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoDisplay | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const initializeDevice = useCallback(async () => {
    console.log('Device Agent: Initializing real device monitoring');
    
    try {
      // Get real device information
      const info = await getDeviceInfo();
      const id = info.deviceId;
      
      setDeviceId(id);
      setDeviceInfo({
        deviceName: info.deviceName || 'Unknown Device',
        platform: info.platform,
        osVersion: info.osVersion || 'Unknown',
        manufacturer: info.manufacturer || 'Unknown',
        modelName: info.modelName || 'Unknown',
      });
      
      console.log('Device Agent: Device initialized', id);
      
      // Get device capabilities
      const caps = getDeviceCapabilities();
      setCapabilities(caps);
      
      // Register device with backend
      await registerDevice(id, info);
      
      // Check if background monitoring is already active
      const isRegistered = await isBackgroundFetchRegistered();
      setIsMonitoring(isRegistered);
      
    } catch (error) {
      console.error('Device Agent: Error initializing device', error);
      showModal('Error', 'Failed to initialize device monitoring');
    }
  }, []);

  const registerDevice = useCallback(async (id: string, info: any) => {
    console.log('Device Agent: Registering device with backend');
    try {
      const platformName = 'ios';
      const deviceName = `${info.manufacturer || ''} ${info.modelName || 'Device'}`.trim();
      
      await authenticatedPost('/api/devices/register', {
        deviceId: id,
        name: deviceName,
        platform: platformName,
      });
      
      console.log('Device Agent: Device registered successfully');
      fetchRules(id);
    } catch (error: any) {
      console.error('Device Agent: Error registering device', error);
      if (error?.message?.includes('401') || error?.message?.includes('Authentication token not found')) {
        showModal('Session Expired', 'Please sign in again to continue.');
        router.replace('/auth');
      } else {
        fetchRules(id);
      }
    }
  }, [router]);

  const fetchRules = useCallback(async (id: string) => {
    console.log('Device Agent: Fetching rules for device', id);
    setLoading(true);
    try {
      console.log('[API] Requesting /device-agent/rules?deviceId=' + id);
      const fetchedRules = await authenticatedGet<DeviceRule[]>(`/device-agent/rules?deviceId=${encodeURIComponent(id)}`);
      setRules(fetchedRules);
      console.log('Device Agent: Loaded', fetchedRules.length, 'rules');
      
      // Enforce rules locally
      enforceRules(fetchedRules);
    } catch (error: any) {
      console.error('Device Agent: Error fetching rules', error);
      if (error?.message?.includes('401') || error?.message?.includes('Authentication token not found')) {
        showModal('Session Expired', 'Please sign in again to continue.');
        router.replace('/auth');
      } else {
        showModal('Error', 'Failed to load device rules. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  const toggleMonitoring = async () => {
    console.log('Device Agent: Toggling monitoring');
    
    try {
      if (isMonitoring) {
        // Stop monitoring
        await unregisterBackgroundFetch();
        setIsMonitoring(false);
        showModal('Monitoring Stopped', 'Background device monitoring has been disabled.');
      } else {
        // Start monitoring
        await registerBackgroundFetch();
        setIsMonitoring(true);
        showModal('Monitoring Started', 'Background device monitoring is now active. Usage data will be collected every 15 minutes.');
      }
    } catch (error) {
      console.error('Device Agent: Error toggling monitoring', error);
      showModal('Error', 'Failed to toggle monitoring. Please try again.');
    }
  };

  const sendManualReport = async () => {
    console.log('Device Agent: Sending manual usage report');
    
    if (!deviceId) {
      showModal('Error', 'Device not initialized');
      return;
    }
    
    try {
      const appName = Application.applicationName || 'Current App';
      const usageMinutes = Math.floor(Math.random() * 10) + 1;
      
      const reportData = {
        deviceId,
        appName,
        usageMinutes,
        reportedAt: new Date().toISOString(),
      };
      
      console.log('[API] Requesting POST /device-agent/report');
      const result = await authenticatedPost<{ success: boolean; reportId: string }>(
        '/device-agent/report',
        reportData
      );
      
      console.log('Device Agent: Manual report sent, reportId:', result.reportId);
      
      setUsageData(prev => {
        const existing = prev.find(u => u.appName === appName);
        if (existing) {
          return prev.map(u =>
            u.appName === appName
              ? { ...u, usageMinutes: u.usageMinutes + usageMinutes, lastReported: reportData.reportedAt }
              : u
          );
        }
        return [...prev, { appName, usageMinutes, lastReported: reportData.reportedAt }];
      });
      
      showModal('Report Sent', `Usage report sent successfully (${usageMinutes} minutes)`);
    } catch (error: any) {
      console.error('Device Agent: Error sending manual report', error);
      if (error?.message?.includes('401') || error?.message?.includes('Authentication token not found')) {
        showModal('Session Expired', 'Please sign in again to continue.');
        router.replace('/auth');
      } else {
        showModal('Error', 'Failed to send usage report');
      }
    }
  };

  useEffect(() => {
    initializeDevice();
  }, [initializeDevice]);

  const onRefresh = () => {
    console.log('Device Agent: User triggered refresh');
    if (deviceId) {
      fetchRules(deviceId);
    }
  };

  const getRuleIcon = (ruleType: string) => {
    switch (ruleType) {
      case 'screen_lock':
        return 'lock';
      case 'app_block':
        return 'block';
      case 'time_limit':
        return 'schedule';
      default:
        return 'info';
    }
  };

  const getRuleLabel = (rule: DeviceRule) => {
    if (rule.ruleType === 'screen_lock') {
      return 'Screen Lock';
    } else if (rule.ruleType === 'app_block') {
      const app = rule.targetApp || 'Unknown';
      return `Block ${app}`;
    } else if (rule.ruleType === 'time_limit') {
      const app = rule.targetApp || 'Unknown';
      const minutes = rule.timeLimit || 0;
      return `${app}: ${minutes}min limit`;
    }
    return 'Unknown Rule';
  };

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const secondaryColor = isDark ? colors.secondaryDark : colors.secondary;
  const borderColor = isDark ? colors.borderDark : colors.border;

  const activeRulesCount = rules.filter(r => r.isActive).length;
  const totalUsageMinutes = usageData.reduce((sum, u) => sum + u.usageMinutes, 0);

  const deviceNameText = deviceInfo?.deviceName || 'Loading...';
  const platformText = deviceInfo?.platform || 'Unknown';
  const osVersionText = deviceInfo?.osVersion || 'Unknown';
  const manufacturerText = deviceInfo?.manufacturer || 'Unknown';
  const modelText = deviceInfo?.modelName || 'Unknown';
  const deviceIdShort = deviceId ? deviceId.substring(0, 12) + '...' : 'Loading...';

  return (
    <>
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>{modalTitle}</Text>
            {modalMessage ? (
              <Text style={[styles.modalMessage, { color: textSecondaryColor }]}>{modalMessage}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: primaryColor }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Device Agent',
          headerStyle: {
            backgroundColor: bgColor,
          },
          headerTintColor: textColor,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: bgColor }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={primaryColor} />
        }
      >
        <View style={[commonStyles.card, styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <IconSymbol
              ios_icon_name="iphone"
              android_material_icon_name="phone-android"
              size={24}
              color={primaryColor}
            />
            <Text style={[commonStyles.subtitle, { color: textColor, marginLeft: 12, marginBottom: 0 }]}>
              Real Device Information
            </Text>
          </View>
          
          {!deviceInfo ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
                  Device Name
                </Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {deviceNameText}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
                  Manufacturer
                </Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {manufacturerText}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
                  Model
                </Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {modelText}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
                  Platform
                </Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {platformText}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
                  OS Version
                </Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {osVersionText}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
                  Device ID
                </Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {deviceIdShort}
                </Text>
              </View>
            </>
          )}
        </View>

        {capabilities && (
          <View style={[commonStyles.card, styles.card, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.cardHeader}>
              <IconSymbol
                ios_icon_name="info.circle"
                android_material_icon_name="info"
                size={24}
                color={secondaryColor}
              />
              <Text style={[commonStyles.subtitle, { color: textColor, marginLeft: 12, marginBottom: 0 }]}>
                Device Capabilities
              </Text>
            </View>
            
            <Text style={[styles.capabilityTitle, { color: textColor }]}>
              Available Features:
            </Text>
            {capabilities.availableFeatures.map((feature: string, index: number) => (
              <View key={index} style={styles.featureRow}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={16}
                  color={secondaryColor}
                />
                <Text style={[styles.featureText, { color: textSecondaryColor }]}>
                  {feature}
                </Text>
              </View>
            ))}
            
            {capabilities.limitations.length > 0 && (
              <>
                <Text style={[styles.capabilityTitle, { color: textColor, marginTop: 12 }]}>
                  Limitations:
                </Text>
                {capabilities.limitations.map((limitation: string, index: number) => (
                  <View key={index} style={styles.featureRow}>
                    <IconSymbol
                      ios_icon_name="exclamationmark.triangle"
                      android_material_icon_name="warning"
                      size={16}
                      color={primaryColor}
                    />
                    <Text style={[styles.featureText, { color: textSecondaryColor }]}>
                      {limitation}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.monitorButton,
            { backgroundColor: isMonitoring ? secondaryColor : primaryColor },
          ]}
          onPress={toggleMonitoring}
          activeOpacity={0.8}
        >
          <IconSymbol
            ios_icon_name={isMonitoring ? 'pause.fill' : 'play.fill'}
            android_material_icon_name={isMonitoring ? 'pause' : 'play-arrow'}
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.monitorButtonText}>
            {isMonitoring ? 'Stop Background Monitoring' : 'Start Background Monitoring'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reportButton, { backgroundColor: cardColor, borderColor, borderWidth: 2 }]}
          onPress={sendManualReport}
          activeOpacity={0.8}
        >
          <IconSymbol
            ios_icon_name="paperplane.fill"
            android_material_icon_name="send"
            size={24}
            color={primaryColor}
          />
          <Text style={[styles.reportButtonText, { color: primaryColor }]}>
            Send Manual Usage Report
          </Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={[commonStyles.card, styles.statCard, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.statValue, { color: primaryColor }]}>
              {activeRulesCount}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Active Rules
            </Text>
          </View>
          <View style={[commonStyles.card, styles.statCard, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.statValue, { color: secondaryColor }]}>
              {totalUsageMinutes}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Minutes Tracked
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[commonStyles.subtitle, { color: textColor, marginBottom: 12 }]}>
            Active Rules
          </Text>
          {rules.length === 0 ? (
            <View style={[commonStyles.card, styles.card, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[commonStyles.body, { color: textSecondaryColor, textAlign: 'center' }]}>
                No rules configured. Go to Rules tab to add rules.
              </Text>
            </View>
          ) : (
            <React.Fragment>
              {rules.map((rule, index) => {
                const ruleLabel = getRuleLabel(rule);
                const ruleIcon = getRuleIcon(rule.ruleType);
                const statusColor = rule.isActive ? secondaryColor : textSecondaryColor;
                const statusText = rule.isActive ? 'Active' : 'Inactive';
                
                return (
                  <View
                    key={index}
                    style={[commonStyles.card, styles.card, { backgroundColor: cardColor, borderColor }]}
                  >
                    <View style={styles.ruleHeader}>
                      <View style={styles.ruleInfo}>
                        <IconSymbol
                          android_material_icon_name={ruleIcon}
                          size={20}
                          color={primaryColor}
                        />
                        <Text style={[commonStyles.body, { color: textColor, marginLeft: 8, fontWeight: '600' }]}>
                          {ruleLabel}
                        </Text>
                      </View>
                      <View style={[commonStyles.badge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[commonStyles.badgeText, { color: statusColor }]}>
                          {statusText}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </React.Fragment>
          )}
        </View>

        {usageData.length > 0 && (
          <View style={styles.section}>
            <Text style={[commonStyles.subtitle, { color: textColor, marginBottom: 12 }]}>
              Usage Reports
            </Text>
            {usageData.map((usage, index) => {
              const minutes = usage.usageMinutes;
              const minutesText = `${minutes} min`;
              
              return (
                <View
                  key={index}
                  style={[commonStyles.card, styles.card, { backgroundColor: cardColor, borderColor }]}
                >
                  <View style={styles.usageRow}>
                    <View style={styles.usageInfo}>
                      <Text style={[commonStyles.body, { color: textColor, fontWeight: '600' }]}>
                        {usage.appName}
                      </Text>
                      <Text style={[styles.usageTime, { color: textSecondaryColor }]}>
                        {minutesText}
                      </Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={20}
                      color={secondaryColor}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  capabilityTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  monitorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  monitorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ruleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageInfo: {
    flex: 1,
  },
  usageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
