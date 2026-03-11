
import { Stack, useRouter } from 'expo-router';
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
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import { IconSymbol } from '@/components/IconSymbol';
import React, { useState, useEffect, useCallback } from 'react';
import { colors, commonStyles } from '@/styles/commonStyles';

interface DeviceRule {
  id: string;
  deviceId: string;
  ruleType: 'screen_lock' | 'app_block' | 'time_limit';
  targetApp: string | null;
  timeLimit: number | null;
  isActive: boolean;
  createdAt: string;
}

interface DeviceInfo {
  id: string;
  name: string | null;
  platform: string | null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  ruleCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ruleTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ruleTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  ruleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  ruleDetails: {
    marginTop: 8,
  },
  ruleDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  ruleDetailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  statusBadgeActive: {
    backgroundColor: '#10B98120',
  },
  statusBadgeInactive: {
    backgroundColor: '#EF444420',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#10B981',
  },
  statusTextInactive: {
    color: '#EF4444',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  picker: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerOptionSelected: {
    backgroundColor: colors.primary + '20',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: colors.text,
  },
  switchButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  switchButtonActive: {
    backgroundColor: colors.primary,
  },
  switchButtonInactive: {
    backgroundColor: colors.border,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: colors.border,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: '#FFFFFF',
  },
  modalButtonTextSecondary: {
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 4,
  },
});

export default function RulesScreen() {
  const colorScheme = useColorScheme();
  const [rules, setRules] = useState<DeviceRule[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<DeviceRule | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const [formDeviceId, setFormDeviceId] = useState('');
  const [formRuleType, setFormRuleType] = useState<'screen_lock' | 'app_block' | 'time_limit'>('app_block');
  const [formTargetApp, setFormTargetApp] = useState('');
  const [formTimeLimit, setFormTimeLimit] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [showRuleTypePicker, setShowRuleTypePicker] = useState(false);

  const { user } = useAuth();
  const router = useRouter();

  const showModal = (title: string, message: string) => {
    console.log('RulesScreen: Showing modal:', title, message);
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const fetchRulesAndDevices = useCallback(async () => {
    console.log('RulesScreen: Fetching rules and devices');
    try {
      setLoading(true);
      console.log('[API] Requesting /api/rules...');
      const rulesData = await authenticatedGet<DeviceRule[]>('/api/rules');
      console.log('RulesScreen: Fetched rules:', rulesData);
      setRules(rulesData);

      console.log('[API] Requesting /api/devices...');
      const devicesData = await authenticatedGet<DeviceInfo[]>('/api/devices');
      console.log('RulesScreen: Fetched devices:', devicesData);
      setDevices(devicesData);
    } catch (error: any) {
      console.error('RulesScreen: Error fetching data:', error);
      if (error.message === 'Authentication token not found' || error.status === 401) {
        router.replace('/auth');
      } else {
        showModal('Error', error.message || 'Failed to load rules');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    console.log('RulesScreen: Component mounted, fetching rules and devices');
    fetchRulesAndDevices();
  }, [fetchRulesAndDevices]);

  const onRefresh = async () => {
    console.log('RulesScreen: User triggered refresh');
    setRefreshing(true);
    await fetchRulesAndDevices();
    setRefreshing(false);
  };

  const handleAddRule = () => {
    console.log('RulesScreen: User tapped Add Rule button');
    setFormDeviceId(devices.length > 0 ? devices[0].id : '');
    setFormRuleType('app_block');
    setFormTargetApp('');
    setFormTimeLimit('');
    setFormIsActive(true);
    setShowAddModal(true);
  };

  const handleSaveNewRule = async () => {
    console.log('RulesScreen: User tapped Save New Rule button');
    if (!formDeviceId) {
      showModal('Error', 'Please select a device');
      return;
    }

    if (formRuleType === 'app_block' && !formTargetApp) {
      showModal('Error', 'Please enter a target app for app block rule');
      return;
    }

    if (formRuleType === 'time_limit' && (!formTargetApp || !formTimeLimit)) {
      showModal('Error', 'Please enter target app and time limit');
      return;
    }

    try {
      const newRule = {
        deviceId: formDeviceId,
        ruleType: formRuleType,
        targetApp: formTargetApp || null,
        timeLimit: formTimeLimit ? parseInt(formTimeLimit) : null,
        isActive: formIsActive,
      };
      console.log('RulesScreen: Creating new rule:', newRule);
      console.log('[API] Requesting POST /api/rules...');
      const createdRule = await authenticatedPost<DeviceRule>('/api/rules', newRule);
      console.log('RulesScreen: Rule created successfully:', createdRule);
      setRules([...rules, createdRule]);
      setShowAddModal(false);
      showModal('Success', 'Rule created successfully');
    } catch (error: any) {
      console.error('RulesScreen: Error creating rule:', error);
      showModal('Error', error.message || 'Failed to create rule');
    }
  };

  const handleEditRule = (rule: DeviceRule) => {
    console.log('RulesScreen: User tapped Edit button for rule:', rule.id);
    setSelectedRule(rule);
    setFormDeviceId(rule.deviceId);
    setFormRuleType(rule.ruleType);
    setFormTargetApp(rule.targetApp || '');
    setFormTimeLimit(rule.timeLimit ? rule.timeLimit.toString() : '');
    setFormIsActive(rule.isActive);
    setShowEditModal(true);
  };

  const handleSaveEditRule = async () => {
    console.log('RulesScreen: User tapped Save Edit button');
    if (!selectedRule) return;

    if (formRuleType === 'app_block' && !formTargetApp) {
      showModal('Error', 'Please enter a target app for app block rule');
      return;
    }

    if (formRuleType === 'time_limit' && (!formTargetApp || !formTimeLimit)) {
      showModal('Error', 'Please enter target app and time limit');
      return;
    }

    try {
      const updatedData = {
        ruleType: formRuleType,
        targetApp: formTargetApp || null,
        timeLimit: formTimeLimit ? parseInt(formTimeLimit) : null,
        isActive: formIsActive,
      };
      console.log('RulesScreen: Updating rule:', selectedRule.id, updatedData);
      console.log(`[API] Requesting PUT /api/rules/${selectedRule.id}...`);
      const updatedRule = await authenticatedPut<DeviceRule>(`/api/rules/${selectedRule.id}`, updatedData);
      console.log('RulesScreen: Rule updated successfully:', updatedRule);
      setRules(rules.map(r => r.id === selectedRule.id ? updatedRule : r));
      setShowEditModal(false);
      setSelectedRule(null);
      showModal('Success', 'Rule updated successfully');
    } catch (error: any) {
      console.error('RulesScreen: Error updating rule:', error);
      showModal('Error', error.message || 'Failed to update rule');
    }
  };

  const handleDeleteRule = (rule: DeviceRule) => {
    console.log('RulesScreen: User tapped Delete button for rule:', rule.id);
    setSelectedRule(rule);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    console.log('RulesScreen: User confirmed delete');
    if (!selectedRule) return;

    try {
      console.log('RulesScreen: Deleting rule:', selectedRule.id);
      console.log(`[API] Requesting DELETE /api/rules/${selectedRule.id}...`);
      await authenticatedDelete(`/api/rules/${selectedRule.id}`);
      console.log('RulesScreen: Rule deleted successfully');
      setRules(rules.filter(r => r.id !== selectedRule.id));
      setShowDeleteModal(false);
      setSelectedRule(null);
      showModal('Success', 'Rule deleted successfully');
    } catch (error: any) {
      console.error('RulesScreen: Error deleting rule:', error);
      showModal('Error', error.message || 'Failed to delete rule');
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
        return 'settings';
    }
  };

  const getRuleTypeLabel = (ruleType: string) => {
    switch (ruleType) {
      case 'screen_lock':
        return 'Screen Lock';
      case 'app_block':
        return 'App Block';
      case 'time_limit':
        return 'Time Limit';
      default:
        return ruleType;
    }
  };

  const getDeviceName = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    const deviceName = device?.name || deviceId.substring(0, 8);
    return deviceName;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Rules',
          headerShown: true,
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Device Rules</Text>
          <Text style={styles.subtitle}>
            Manage rules for your devices
          </Text>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddRule}>
          <IconSymbol
            ios_icon_name="plus"
            android_material_icon_name="add"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.addButtonText}>Add New Rule</Text>
        </TouchableOpacity>

        {rules.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="doc.text"
              android_material_icon_name="description"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateText}>
              No rules yet.{'\n'}Tap the button above to create your first rule.
            </Text>
          </View>
        ) : (
          rules.map((rule) => {
            const ruleTypeLabel = getRuleTypeLabel(rule.ruleType);
            const deviceName = getDeviceName(rule.deviceId);
            const statusBadgeStyle = rule.isActive ? styles.statusBadgeActive : styles.statusBadgeInactive;
            const statusTextStyle = rule.isActive ? styles.statusTextActive : styles.statusTextInactive;
            const statusText = rule.isActive ? 'Active' : 'Inactive';

            return (
              <View key={rule.id} style={styles.ruleCard}>
                <View style={styles.ruleHeader}>
                  <View style={styles.ruleTypeContainer}>
                    <IconSymbol
                      ios_icon_name="shield"
                      android_material_icon_name={getRuleIcon(rule.ruleType)}
                      size={24}
                      color={colors.primary}
                    />
                    <Text style={styles.ruleTypeText}>{ruleTypeLabel}</Text>
                  </View>
                  <View style={styles.ruleActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditRule(rule)}
                    >
                      <IconSymbol
                        ios_icon_name="pencil"
                        android_material_icon_name="edit"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDeleteRule(rule)}
                    >
                      <IconSymbol
                        ios_icon_name="trash"
                        android_material_icon_name="delete"
                        size={20}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.ruleDetails}>
                  <View style={styles.ruleDetailRow}>
                    <IconSymbol
                      ios_icon_name="phone"
                      android_material_icon_name="phone"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.ruleDetailText}>
                      {deviceName}
                    </Text>
                  </View>

                  {rule.targetApp && (
                    <View style={styles.ruleDetailRow}>
                      <IconSymbol
                        ios_icon_name="app"
                        android_material_icon_name="apps"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.ruleDetailText}>
                        {rule.targetApp}
                      </Text>
                    </View>
                  )}

                  {rule.timeLimit && (
                    <View style={styles.ruleDetailRow}>
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="schedule"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.ruleDetailText}>
                        {rule.timeLimit}
                      </Text>
                      <Text style={styles.ruleDetailText}>minutes</Text>
                    </View>
                  )}

                  <View style={[styles.statusBadge, statusBadgeStyle]}>
                    <Text style={[styles.statusText, statusTextStyle]}>
                      {statusText}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Rule</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Device</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDevicePicker(!showDevicePicker)}
              >
                <Text style={{ color: colors.text }}>
                  {getDeviceName(formDeviceId)}
                </Text>
              </TouchableOpacity>
              {showDevicePicker && (
                <View style={styles.picker}>
                  {devices.map((device) => {
                    const deviceDisplayName = device.name || device.id.substring(0, 8);
                    const isSelected = device.id === formDeviceId;
                    const optionStyle = isSelected ? styles.pickerOptionSelected : null;
                    return (
                      <TouchableOpacity
                        key={device.id}
                        style={[styles.pickerOption, optionStyle]}
                        onPress={() => {
                          setFormDeviceId(device.id);
                          setShowDevicePicker(false);
                        }}
                      >
                        <Text style={styles.pickerOptionText}>
                          {deviceDisplayName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Rule Type</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowRuleTypePicker(!showRuleTypePicker)}
              >
                <Text style={{ color: colors.text }}>
                  {getRuleTypeLabel(formRuleType)}
                </Text>
              </TouchableOpacity>
              {showRuleTypePicker && (
                <View style={styles.picker}>
                  {(['screen_lock', 'app_block', 'time_limit'] as const).map((type) => {
                    const typeLabel = getRuleTypeLabel(type);
                    const isSelected = type === formRuleType;
                    const optionStyle = isSelected ? styles.pickerOptionSelected : null;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.pickerOption, optionStyle]}
                        onPress={() => {
                          setFormRuleType(type);
                          setShowRuleTypePicker(false);
                        }}
                      >
                        <Text style={styles.pickerOptionText}>{typeLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {(formRuleType === 'app_block' || formRuleType === 'time_limit') && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Target App</Text>
                <TextInput
                  style={styles.input}
                  value={formTargetApp}
                  onChangeText={setFormTargetApp}
                  placeholder="e.g., com.instagram.android"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            )}

            {formRuleType === 'time_limit' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Time Limit (minutes)</Text>
                <TextInput
                  style={styles.input}
                  value={formTimeLimit}
                  onChangeText={setFormTimeLimit}
                  placeholder="e.g., 60"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <TouchableOpacity
                  style={[
                    styles.switchButton,
                    formIsActive ? styles.switchButtonActive : styles.switchButtonInactive,
                  ]}
                  onPress={() => setFormIsActive(!formIsActive)}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      { alignSelf: formIsActive ? 'flex-end' : 'flex-start' },
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveNewRule}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Rule</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Device</Text>
              <View style={styles.input}>
                <Text style={{ color: colors.textSecondary }}>
                  {getDeviceName(formDeviceId)}
                </Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Rule Type</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowRuleTypePicker(!showRuleTypePicker)}
              >
                <Text style={{ color: colors.text }}>
                  {getRuleTypeLabel(formRuleType)}
                </Text>
              </TouchableOpacity>
              {showRuleTypePicker && (
                <View style={styles.picker}>
                  {(['screen_lock', 'app_block', 'time_limit'] as const).map((type) => {
                    const typeLabel = getRuleTypeLabel(type);
                    const isSelected = type === formRuleType;
                    const optionStyle = isSelected ? styles.pickerOptionSelected : null;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.pickerOption, optionStyle]}
                        onPress={() => {
                          setFormRuleType(type);
                          setShowRuleTypePicker(false);
                        }}
                      >
                        <Text style={styles.pickerOptionText}>{typeLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {(formRuleType === 'app_block' || formRuleType === 'time_limit') && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Target App</Text>
                <TextInput
                  style={styles.input}
                  value={formTargetApp}
                  onChangeText={setFormTargetApp}
                  placeholder="e.g., com.instagram.android"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            )}

            {formRuleType === 'time_limit' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Time Limit (minutes)</Text>
                <TextInput
                  style={styles.input}
                  value={formTimeLimit}
                  onChangeText={setFormTimeLimit}
                  placeholder="e.g., 60"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <TouchableOpacity
                  style={[
                    styles.switchButton,
                    formIsActive ? styles.switchButtonActive : styles.switchButtonInactive,
                  ]}
                  onPress={() => setFormIsActive(!formIsActive)}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      { alignSelf: formIsActive ? 'flex-end' : 'flex-start' },
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveEditRule}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Rule</Text>
            <Text style={{ color: colors.text, marginBottom: 20 }}>
              Are you sure you want to delete this rule? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#EF4444' }]}
                onPress={confirmDelete}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={{ color: colors.text, marginBottom: 20 }}>
              {modalMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
