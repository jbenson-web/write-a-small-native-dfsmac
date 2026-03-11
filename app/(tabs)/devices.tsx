
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useColorScheme,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import * as Device from 'expo-constants';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface DeviceInfo {
  id: string;
  userId: string;
  name: string | null;
  platform: string | null;
  lastSeenAt: string;
  createdAt: string;
}

interface DeviceStats {
  deviceId: string;
  totalReports: number;
  totalUsageMinutes: number;
  activeRules: number;
  lastReportAt: string | null;
}

export default function DevicesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const router = useRouter();
  
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceInfo | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingDevice, setDeletingDevice] = useState<DeviceInfo | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, DeviceStats>>({});

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const registerCurrentDevice = useCallback(async (id: string) => {
    console.log('Devices Screen: Registering current device');
    try {
      const platformName = Platform.OS as 'ios' | 'android' | 'web';
      const deviceName = `${Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1)} Device`;
      
      await authenticatedPost('/api/devices/register', {
        deviceId: id,
        name: deviceName,
        platform: platformName,
      });
      console.log('Devices Screen: Device registered successfully');
      fetchDevices();
    } catch (error: any) {
      console.error('Devices Screen: Error registering device', error);
      if (error?.message?.includes('401') || error?.message?.includes('Authentication token not found')) {
        showModal('Session Expired', 'Please sign in again to continue.');
        router.replace('/auth');
      }
    }
  }, [router]);

  const fetchDevices = useCallback(async () => {
    console.log('Devices Screen: Fetching devices');
    setLoading(true);
    try {
      const fetchedDevices = await authenticatedGet<DeviceInfo[]>('/api/devices');
      setDevices(fetchedDevices);
      console.log('Devices Screen: Loaded', fetchedDevices.length, 'devices');
      
      const statsPromises = fetchedDevices.map(device => fetchDeviceStats(device.id));
      await Promise.all(statsPromises);
    } catch (error: any) {
      console.error('Devices Screen: Error fetching devices', error);
      if (error?.message?.includes('401') || error?.message?.includes('Authentication token not found')) {
        showModal('Session Expired', 'Please sign in again to continue.');
        router.replace('/auth');
      } else {
        showModal('Error', 'Failed to load devices. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchDeviceStats = async (deviceId: string) => {
    try {
      const stats = await authenticatedGet<DeviceStats>(`/api/devices/${encodeURIComponent(deviceId)}/stats`);
      setStatsMap(prev => ({ ...prev, [deviceId]: stats }));
    } catch (error) {
      console.error('Devices Screen: Error fetching stats for device', deviceId, error);
    }
  };

  useEffect(() => {
    console.log('Devices Screen: Initializing');
    const id = Device.default.deviceId || Device.default.sessionId || 'unknown-device';
    setCurrentDeviceId(id);
    console.log('Devices Screen: Current device ID', id);
    registerCurrentDevice(id);
  }, [registerCurrentDevice]);

  const handleEditDevice = (device: DeviceInfo) => {
    console.log('Devices Screen: User tapped edit for device', device.id);
    setEditingDevice(device);
    setEditName(device.name || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDevice) return;
    
    console.log('Devices Screen: Saving device name', editName);
    try {
      const updated = await authenticatedPut<DeviceInfo>(`/api/devices/${encodeURIComponent(editingDevice.id)}`, {
        name: editName,
      });
      
      setDevices(prev => prev.map(d => d.id === updated.id ? updated : d));
      setEditModalVisible(false);
      setEditingDevice(null);
      console.log('Devices Screen: Device name updated successfully');
    } catch (error: any) {
      console.error('Devices Screen: Error updating device', error);
      showModal('Error', 'Failed to update device name. Please try again.');
    }
  };

  const handleDeleteDevice = (device: DeviceInfo) => {
    console.log('Devices Screen: User tapped delete for device', device.id);
    setDeletingDevice(device);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!deletingDevice) return;
    
    console.log('Devices Screen: Deleting device', deletingDevice.id);
    try {
      await authenticatedDelete(`/api/devices/${encodeURIComponent(deletingDevice.id)}`);
      
      setDevices(prev => prev.filter(d => d.id !== deletingDevice.id));
      setDeleteModalVisible(false);
      setDeletingDevice(null);
      console.log('Devices Screen: Device deleted successfully');
    } catch (error: any) {
      console.error('Devices Screen: Error deleting device', error);
      showModal('Error', 'Failed to delete device. Please try again.');
    }
  };

  const onRefresh = () => {
    console.log('Devices Screen: User triggered refresh');
    fetchDevices();
  };

  const getPlatformIcon = (platform: string | null) => {
    switch (platform) {
      case 'ios':
        return 'phone-iphone';
      case 'android':
        return 'phone-android';
      case 'web':
        return 'computer';
      default:
        return 'devices';
    }
  };

  const formatLastSeen = (lastSeenAt: string) => {
    const date = new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const secondaryColor = isDark ? colors.secondaryDark : colors.secondary;
  const borderColor = isDark ? colors.borderDark : colors.border;
  const dangerColor = isDark ? colors.dangerDark : colors.danger;

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

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 400 }}>
            <View style={[styles.modalContainer, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Edit Device Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: bgColor, color: textColor, borderColor }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Device name"
                placeholderTextColor={textSecondaryColor}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary, { borderColor }]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={[styles.modalButtonTextSecondary, { color: textColor }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: primaryColor }]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDeleteModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 400 }}>
            <View style={[styles.modalContainer, { backgroundColor: cardColor, borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Delete Device</Text>
              <Text style={[styles.modalMessage, { color: textSecondaryColor }]}>
                Are you sure you want to delete this device? All associated rules and reports will be permanently removed.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary, { borderColor }]}
                  onPress={() => setDeleteModalVisible(false)}
                >
                  <Text style={[styles.modalButtonTextSecondary, { color: textColor }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: dangerColor }]}
                  onPress={confirmDelete}
                >
                  <Text style={styles.modalButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Stack.Screen
        options={{
          headerShown: true,
          title: 'My Devices',
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
          <Text style={[commonStyles.body, { color: textSecondaryColor }]}>
            Manage all devices connected to your account. You can rename or remove devices at any time.
          </Text>
        </View>

        {loading && devices.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : devices.length === 0 ? (
          <View style={[commonStyles.card, styles.card, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[commonStyles.body, { color: textSecondaryColor, textAlign: 'center' }]}>
              No devices registered yet
            </Text>
          </View>
        ) : (
          <React.Fragment>
            {devices.map((device, index) => {
              const isCurrentDevice = device.id === currentDeviceId;
              const platformIcon = getPlatformIcon(device.platform);
              const lastSeenText = formatLastSeen(device.lastSeenAt);
              const stats = statsMap[device.id];
              const deviceName = device.name || 'Unnamed Device';
              const platformText = device.platform || 'unknown';
              
              return (
                <View
                  key={index}
                  style={[
                    commonStyles.card,
                    styles.card,
                    { backgroundColor: cardColor, borderColor },
                    isCurrentDevice && { borderColor: primaryColor, borderWidth: 2 },
                  ]}
                >
                  <View style={styles.deviceHeader}>
                    <View style={styles.deviceInfo}>
                      <IconSymbol
                        android_material_icon_name={platformIcon}
                        size={32}
                        color={primaryColor}
                      />
                      <View style={styles.deviceText}>
                        <View style={styles.deviceNameRow}>
                          <Text style={[commonStyles.subtitle, { color: textColor, marginBottom: 0 }]}>
                            {deviceName}
                          </Text>
                          {isCurrentDevice && (
                            <View style={[commonStyles.badge, { backgroundColor: secondaryColor + '20', marginLeft: 8 }]}>
                              <Text style={[commonStyles.badgeText, { color: secondaryColor }]}>
                                Current
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.devicePlatform, { color: textSecondaryColor }]}>
                          {platformText}
                        </Text>
                        <Text style={[styles.deviceLastSeen, { color: textSecondaryColor }]}>
                          {lastSeenText}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {stats && (
                    <View style={styles.statsContainer}>
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: primaryColor }]}>
                          {stats.activeRules}
                        </Text>
                        <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
                          Rules
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: secondaryColor }]}>
                          {stats.totalReports}
                        </Text>
                        <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
                          Reports
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: textColor }]}>
                          {stats.totalUsageMinutes}
                        </Text>
                        <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
                          Minutes
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.deviceActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor }]}
                      onPress={() => handleEditDevice(device)}
                    >
                      <IconSymbol
                        android_material_icon_name="edit"
                        size={18}
                        color={primaryColor}
                      />
                      <Text style={[styles.actionButtonText, { color: primaryColor }]}>
                        Rename
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor }]}
                      onPress={() => handleDeleteDevice(device)}
                    >
                      <IconSymbol
                        android_material_icon_name="delete"
                        size={18}
                        color={dangerColor}
                      />
                      <Text style={[styles.actionButtonText, { color: dangerColor }]}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </React.Fragment>
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
    paddingTop: Platform.OS === 'android' ? 48 : 16,
  },
  card: {
    borderWidth: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  deviceHeader: {
    marginBottom: 16,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  deviceText: {
    marginLeft: 12,
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  devicePlatform: {
    fontSize: 14,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  deviceLastSeen: {
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
  },
});
