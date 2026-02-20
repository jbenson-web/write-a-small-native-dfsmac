import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Sign Out Confirmation Modal */}
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

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <GlassView style={styles.profileHeader} glassEffectStyle="regular">
          <IconSymbol ios_icon_name="person.circle.fill" android_material_icon_name="person" size={80} color={theme.colors.primary} />
          <Text style={[styles.name, { color: theme.colors.text }]}>{displayName}</Text>
          <Text style={[styles.email, { color: theme.dark ? '#98989D' : '#666' }]}>{displayEmail}</Text>
        </GlassView>

        <GlassView style={styles.section} glassEffectStyle="regular">
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
  profileHeader: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    gap: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 16,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    gap: 12,
    marginBottom: 16,
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
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
