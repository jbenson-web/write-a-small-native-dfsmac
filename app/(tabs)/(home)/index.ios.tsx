
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useColorScheme,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import * as Device from 'expo-constants';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

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

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const router = useRouter();
  
  const [rules, setRules] = useState<DeviceRule[]>([]);
  const [usageData, setUsageData] = useState<UsageReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    console.log('Device Agent: Initializing device monitoring');
    const id = Device.default.deviceId || Device.default.sessionId || 'unknown-device';
    setDeviceId(id);
    console.log('Device Agent: Device ID set to', id);
    registerDevice(id);
  }, []);

  const registerDevice = async (id: string) => {
    console.log('Device Agent: Registering device');
    try {
      await authenticatedPost('/api/devices/register', {
        deviceId: id,
        name: 'iOS Device',
        platform: 'ios',
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
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isMonitoring) {
      console.log('Device Agent: Starting monitoring interval');
      interval = setInterval(() => {
        simulateUsageReport();
      }, 60000); // Report every minute
    }
    return () => {
      if (interval) {
        console.log('Device Agent: Clearing monitoring interval');
        clearInterval(interval);
      }
    };
  }, [isMonitoring, deviceId]);

  const fetchRules = async (id: string) => {
    console.log('Device Agent: Fetching rules for device', id);
    setLoading(true);
    try {
      console.log('[API] Requesting /device-agent/rules?deviceId=' + id);
      const fetchedRules = await authenticatedGet<DeviceRule[]>(`/device-agent/rules?deviceId=${encodeURIComponent(id)}`);
      setRules(fetchedRules);
      console.log('Device Agent: Loaded', fetchedRules.length, 'rules');
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
  };

  const enforceRules = (rulesToEnforce: DeviceRule[]) => {
    console.log('Device Agent: Enforcing', rulesToEnforce.length, 'rules locally');
    rulesToEnforce.forEach(rule => {
      if (!rule.isActive) return;
      
      if (rule.ruleType === 'screen_lock') {
        console.log('Device Agent: Screen lock rule active');
      } else if (rule.ruleType === 'app_block' && rule.targetApp) {
        console.log('Device Agent: Blocking app:', rule.targetApp);
      } else if (rule.ruleType === 'time_limit' && rule.targetApp && rule.timeLimit) {
        const minutes = rule.timeLimit;
        console.log('Device Agent: Time limit for', rule.targetApp, ':', minutes, 'minutes');
      }
    });
  };

  const simulateUsageReport = async () => {
    console.log('Device Agent: Simulating usage report');
    const apps = ['Social Media', 'Browser', 'Email', 'Games', 'Productivity'];
    const randomApp = apps[Math.floor(Math.random() * apps.length)];
    const usageMinutes = Math.floor(Math.random() * 10) + 1;
    
    const reportData = {
      deviceId,
      appName: randomApp,
      usageMinutes,
      reportedAt: new Date().toISOString(),
    };
    
    console.log('Device Agent: Reporting usage:', reportData);
    
    try {
      console.log('[API] Requesting POST /device-agent/report');
      const result = await authenticatedPost<{ success: boolean; reportId: string }>(
        '/device-agent/report',
        reportData
      );
      console.log('Device Agent: Usage report sent successfully, reportId:', result.reportId);
      
      setUsageData(prev => {
        const existing = prev.find(u => u.appName === randomApp);
        if (existing) {
          return prev.map(u =>
            u.appName === randomApp
              ? { ...u, usageMinutes: u.usageMinutes + usageMinutes, lastReported: reportData.reportedAt }
              : u
          );
        }
        return [...prev, { appName: randomApp, usageMinutes, lastReported: reportData.reportedAt }];
      });
    } catch (error: any) {
      console.error('Device Agent: Error sending usage report', error);
      if (error?.message?.includes('401') || error?.message?.includes('Authentication token not found')) {
        setIsMonitoring(false);
        showModal('Session Expired', 'Please sign in again to continue.');
        router.replace('/auth');
      }
    }
  };

  const toggleMonitoring = () => {
    const newState = !isMonitoring;
    setIsMonitoring(newState);
    console.log('Device Agent: Monitoring', newState ? 'started' : 'stopped');
  };

  const onRefresh = () => {
    console.log('Device Agent: User triggered refresh');
    fetchRules(deviceId);
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

  return (
    <>
      {/* Web-compatible Modal (no Alert.alert) */}
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
          headerLargeTitle: true,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: bgColor }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={primaryColor} />
        }
      >
        {/* Device Info Card */}
        <View style={[commonStyles.card, styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <IconSymbol
              ios_icon_name="iphone"
              android_material_icon_name="phone-android"
              size={24}
              color={primaryColor}
            />
            <Text style={[commonStyles.subtitle, { color: textColor, marginLeft: 12, marginBottom: 0 }]}>
              Device Status
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
              Device ID
            </Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {deviceId.substring(0, 12)}...
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
              Platform
            </Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              iOS
            </Text>
          </View>
        </View>

        {/* Monitoring Control */}
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
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </Text>
        </TouchableOpacity>

        {/* Stats Cards */}
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

        {/* Active Rules */}
        <View style={styles.section}>
          <Text style={[commonStyles.subtitle, { color: textColor, marginBottom: 12 }]}>
            Active Rules
          </Text>
          {rules.length === 0 ? (
            <View style={[commonStyles.card, styles.card, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[commonStyles.body, { color: textSecondaryColor, textAlign: 'center' }]}>
                No rules configured
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
                          ios_icon_name={ruleIcon}
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

        {/* Usage Reports */}
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
  monitorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  monitorButtonText: {
    color: '#FFFFFF',
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
