
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { authenticatedGet, authenticatedPost } from "@/utils/api";

interface QuickStats {
  activeRules: number;
  totalDevices: number;
  currentStreak: number;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [quickStats, setQuickStats] = useState<QuickStats>({ activeRules: 0, totalDevices: 0, currentStreak: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [processingEmergency, setProcessingEmergency] = useState(false);

  const fetchQuickStats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoadingStats(true);
      const [devices, gamificationStats] = await Promise.all([
        authenticatedGet<any[]>('/api/devices'),
        authenticatedGet<any>('/api/gamification/stats').catch(() => ({ currentStreak: 0 }))
      ]);

      const activeRulesCount = 0;
      
      setQuickStats({
        activeRules: activeRulesCount,
        totalDevices: devices.length,
        currentStreak: gamificationStats.currentStreak || 0,
      });
    } catch (error) {
      console.log('Error fetching quick stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchQuickStats();
  }, [fetchQuickStats]);

  const handleSignOut = async () => {
    setSignOutModalVisible(false);
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      router.replace('/auth');
    }
  };

  const handleEmergencyAccess = () => {
    setEmergencyModalVisible(true);
  };

  const confirmEmergencyAccess = async () => {
    setProcessingEmergency(true);
    try {
      console.log('Emergency access activated - navigating to devices');
      setEmergencyModalVisible(false);
      router.push('/(tabs)/devices');
    } catch (error) {
      console.log('Error during emergency access:', error);
    } finally {
      setProcessingEmergency(false);
    }
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSignOutModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalContainer, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Sign Out</Text>
            <Text style={[styles.modalMessage, { color: theme.dark ? '#98989D' : '#666' }]}>
              Are you sure you want to sign out?
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#EF4444' }]}
              onPress={handleSignOut}
            >
              <Text style={styles.modalButtonText}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.dark ? '#334155' : '#E2E8F0', marginTop: 8 }]}
              onPress={() => setSignOutModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={emergencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmergencyModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEmergencyModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalContainer, { backgroundColor: theme.colors.card }]}>
            <IconSymbol ios_icon_name="exclamationmark.triangle.fill" android_material_icon_name="warning" size={48} color="#F59E0B" />
            <Text style={[styles.modalTitle, { color: theme.colors.text, marginTop: 16 }]}>Emergency Access</Text>
            <Text style={[styles.modalMessage, { color: theme.dark ? '#98989D' : '#666' }]}>
              This will take you to device management where you can quickly modify or disable rules.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#F59E0B' }]}
              onPress={confirmEmergencyAccess}
              disabled={processingEmergency}
            >
              {processingEmergency ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.dark ? '#334155' : '#E2E8F0', marginTop: 8 }]}
              onPress={() => setEmergencyModalVisible(false)}
            >
              <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar
        ]}
      >
        <GlassView style={[
          styles.profileHeader,
          Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
        ]} glassEffectStyle="regular">
          <IconSymbol ios_icon_name="person.circle.fill" android_material_icon_name="person" size={80} color={theme.colors.primary} />
          <Text style={[styles.name, { color: theme.colors.text }]}>{displayName}</Text>
          <Text style={[styles.email, { color: theme.dark ? '#98989D' : '#666' }]}>{displayEmail}</Text>
        </GlassView>

        <View style={styles.sectionHeader}>
          <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="flash-on" size={20} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Easy Access</Text>
        </View>

        <GlassView style={[
          styles.section,
          Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
        ]} glassEffectStyle="regular">
          {loadingStats ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : (
            <View style={styles.quickStatsGrid}>
              <View style={styles.statCard}>
                <IconSymbol ios_icon_name="iphone" android_material_icon_name="devices" size={24} color="#3B82F6" />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{quickStats.totalDevices}</Text>
                <Text style={[styles.statLabel, { color: theme.dark ? '#98989D' : '#666' }]}>Devices</Text>
              </View>
              <View style={styles.statCard}>
                <IconSymbol ios_icon_name="flame.fill" android_material_icon_name="local-fire-department" size={24} color="#F59E0B" />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{quickStats.currentStreak}</Text>
                <Text style={[styles.statLabel, { color: theme.dark ? '#98989D' : '#666' }]}>Day Streak</Text>
              </View>
            </View>
          )}
        </GlassView>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.quickActionCard, { backgroundColor: '#3B82F6' }]}
            onPress={() => router.push('/(tabs)/rules')}
          >
            <IconSymbol ios_icon_name="shield.fill" android_material_icon_name="shield" size={32} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Manage Rules</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionCard, { backgroundColor: '#10B981' }]}
            onPress={() => router.push('/(tabs)/devices')}
          >
            <IconSymbol ios_icon_name="iphone" android_material_icon_name="devices" size={32} color="#FFFFFF" />
            <Text style={styles.quickActionText}>View Devices</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionCard, { backgroundColor: '#8B5CF6' }]}
            onPress={() => router.push('/(tabs)/gamification')}
          >
            <IconSymbol ios_icon_name="trophy.fill" android_material_icon_name="emoji-events" size={32} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Progress</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionCard, { backgroundColor: '#F59E0B' }]}
            onPress={handleEmergencyAccess}
          >
            <IconSymbol ios_icon_name="exclamationmark.triangle.fill" android_material_icon_name="warning" size={32} color="#FFFFFF" />
            <Text style={styles.quickActionText}>Emergency</Text>
          </TouchableOpacity>
        </View>

        <GlassView style={[
          styles.section,
          Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
        ]} glassEffectStyle="regular">
          <View style={styles.infoRow}>
            <IconSymbol ios_icon_name="person.badge.key.fill" android_material_icon_name="badge" size={20} color={theme.dark ? '#98989D' : '#666'} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              {user?.id ? `ID: ${user.id.substring(0, 16)}...` : 'Not signed in'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <IconSymbol ios_icon_name="checkmark.shield.fill" android_material_icon_name="verified-user" size={20} color={theme.dark ? '#98989D' : '#666'} />
            <Text style={[styles.infoText, { color: theme.colors.text }]}>Device Agent Active</Text>
          </View>
        </GlassView>

        <TouchableOpacity
          style={[styles.signOutButton, { opacity: signingOut ? 0.6 : 1 }]}
          onPress={() => setSignOutModalVisible(true)}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <IconSymbol ios_icon_name="rectangle.portrait.and.arrow.right" android_material_icon_name="logout" size={20} color="#FFFFFF" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 32,
    marginBottom: 24,
    gap: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    borderRadius: 12,
    padding: 20,
    gap: 12,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  quickStatsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  quickActionCard: {
    flex: 1,
    minWidth: '47%',
    aspectRatio: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    flex: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    alignItems: 'center',
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
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
