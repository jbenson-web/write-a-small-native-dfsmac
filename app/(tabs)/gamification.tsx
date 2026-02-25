
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
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import React, { useState, useEffect } from 'react';
import { colors, commonStyles } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import * as Device from 'expo-constants';

interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  perfectDays: number;
  lastCheckIn: string | null;
}

interface Achievement {
  id: string;
  achievementType: string;
  unlockedAt: string;
  metadata?: any;
}

interface Reward {
  id: string;
  rewardType: string;
  rewardName: string;
  rewardDescription: string;
  earnedAt: string;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  currentStreak: number;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  statsContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    ...commonStyles.shadow,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  checkInButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  checkInButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  checkInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  achievementsContainer: {
    marginBottom: 24,
  },
  achievementCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...commonStyles.shadow,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  achievementDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  rewardsContainer: {
    marginBottom: 24,
  },
  rewardCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...commonStyles.shadow,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  rewardBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  rewardName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  rewardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  rewardDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newAchievementBanner: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  newAchievementText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  leaderboardContainer: {
    marginBottom: 24,
  },
  leaderboardCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  leaderboardRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  leaderboardRankText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  leaderboardStreak: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  leaderboardPoints: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
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
    backgroundColor: colors.cardBackground,
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
    color: colors.text,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    color: colors.textSecondary,
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  checkInResult: {
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  checkInResultPoints: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
  },
  checkInResultLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

export default function GamificationScreen() {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [checkInResult, setCheckInResult] = useState<{ pointsEarned: number; currentStreak: number } | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    if (user) {
      fetchGamificationData();
    }
  }, [user]);

  const fetchGamificationData = async () => {
    console.log('[API] Fetching gamification data');
    try {
      const [statsData, achievementsData, rewardsData, leaderboardData] = await Promise.all([
        authenticatedGet<UserStats>('/api/gamification/stats'),
        authenticatedGet<Achievement[]>('/api/gamification/achievements'),
        authenticatedGet<Reward[]>('/api/gamification/rewards'),
        authenticatedGet<LeaderboardEntry[]>('/api/gamification/leaderboard'),
      ]);

      console.log('[API] Stats:', statsData);
      console.log('[API] Achievements:', achievementsData);
      console.log('[API] Rewards:', rewardsData);
      console.log('[API] Leaderboard:', leaderboardData);

      setStats(statsData);
      setAchievements(achievementsData);
      setRewards(rewardsData);
      setLeaderboard(leaderboardData);
    } catch (error: any) {
      console.error('[API] Error fetching gamification data:', error);
      if (error?.message?.includes('401') || error?.message?.includes('Authentication token not found')) {
        showModal('Session Expired', 'Please sign in again to continue.');
        router.replace('/auth');
      } else {
        showModal('Error', 'Failed to load gamification data. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGamificationData();
  };

  const handleCheckIn = async () => {
    console.log('[API] User tapped Check In button');
    setCheckingIn(true);
    try {
      const deviceId = Device.default.deviceId || Device.default.sessionId || 'unknown-device';
      console.log('[API] Requesting POST /api/gamification/check-in with deviceId:', deviceId);

      const response = await authenticatedPost<{
        success: boolean;
        pointsEarned: number;
        newAchievements: string[];
        currentStreak: number;
      }>('/api/gamification/check-in', { deviceId });

      console.log('[API] Check-in response:', response);

      if (response.success) {
        setNewAchievements(response.newAchievements);
        setCheckInResult({ pointsEarned: response.pointsEarned, currentStreak: response.currentStreak });
        setTimeout(() => {
          setNewAchievements([]);
          setCheckInResult(null);
        }, 5000);
        fetchGamificationData();
      }
    } catch (error: any) {
      console.error('[API] Error checking in:', error);
      if (error?.message?.includes('401') || error?.message?.includes('Authentication token not found')) {
        showModal('Session Expired', 'Please sign in again to continue.');
        router.replace('/auth');
      } else {
        showModal('Check-In Failed', 'Unable to complete check-in. Please try again.');
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const getAchievementIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      first_rule: 'star',
      week_streak: 'local-fire-department',
      month_streak: 'emoji-events',
      perfect_day: 'check-circle',
      rule_master: 'military-tech',
    };
    return iconMap[type] || 'star';
  };

  const getAchievementTitle = (type: string) => {
    const titleMap: Record<string, string> = {
      first_rule: 'First Rule',
      week_streak: '7-Day Streak',
      month_streak: '30-Day Streak',
      perfect_day: 'Perfect Day',
      rule_master: 'Rule Master',
    };
    return titleMap[type] || type;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const canCheckIn = () => {
    if (!stats?.lastCheckIn) return true;
    const lastCheckIn = new Date(stats.lastCheckIn);
    const now = new Date();
    const hoursSinceLastCheckIn = (now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastCheckIn >= 20;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: 'Gamification',
            headerShown: true,
          }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const checkInEnabled = canCheckIn();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Gamification',
          headerShown: true,
        }}
      />

      {/* Info/Error Modal */}
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
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            {modalMessage ? (
              <Text style={styles.modalMessage}>{modalMessage}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Progress</Text>
          <Text style={styles.subtitle}>Keep up the great work!</Text>
        </View>

        {checkInResult && (
          <View style={styles.checkInResult}>
            <IconSymbol
              ios_icon_name="star.fill"
              android_material_icon_name="star"
              size={32}
              color={colors.primary}
            />
            <Text style={styles.checkInResultPoints}>+{checkInResult.pointsEarned} pts</Text>
            <Text style={styles.checkInResultLabel}>🔥 {checkInResult.currentStreak} day streak!</Text>
          </View>
        )}

        {newAchievements.length > 0 && (
          <View style={styles.newAchievementBanner}>
            <IconSymbol
              ios_icon_name="star.fill"
              android_material_icon_name="star"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.newAchievementText}>
              New achievement unlocked: {newAchievements.join(', ')}!
            </Text>
          </View>
        )}

        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <IconSymbol
                  ios_icon_name="flame.fill"
                  android_material_icon_name="local-fire-department"
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.statValue}>{stats.currentStreak}</Text>
                <Text style={styles.statLabel}>Current Streak</Text>
              </View>

              <View style={styles.statBox}>
                <IconSymbol
                  ios_icon_name="star.fill"
                  android_material_icon_name="star"
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.statValue}>{stats.totalPoints}</Text>
                <Text style={styles.statLabel}>Total Points</Text>
              </View>

              <View style={styles.statBox}>
                <IconSymbol
                  ios_icon_name="trophy.fill"
                  android_material_icon_name="emoji-events"
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.statValue}>{stats.longestStreak}</Text>
                <Text style={styles.statLabel}>Longest Streak</Text>
              </View>

              <View style={styles.statBox}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.statValue}>{stats.perfectDays}</Text>
                <Text style={styles.statLabel}>Perfect Days</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.checkInButton,
                !checkInEnabled && styles.checkInButtonDisabled,
              ]}
              onPress={handleCheckIn}
              disabled={!checkInEnabled || checkingIn}
            >
              {checkingIn ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.checkInButtonText}>
                  {checkInEnabled ? 'Check In Today' : 'Already Checked In'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.achievementsContainer}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          {achievements.length > 0 ? (
            achievements.map((achievement) => {
              const achievementTitle = getAchievementTitle(achievement.achievementType);
              const achievementDate = formatDate(achievement.unlockedAt);
              const achievementIcon = getAchievementIcon(achievement.achievementType);

              return (
                <View key={achievement.id} style={styles.achievementCard}>
                  <View style={styles.achievementIcon}>
                    <IconSymbol
                      ios_icon_name="star.fill"
                      android_material_icon_name={achievementIcon}
                      size={24}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={styles.achievementContent}>
                    <Text style={styles.achievementTitle}>{achievementTitle}</Text>
                    <Text style={styles.achievementDate}>Unlocked {achievementDate}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="star"
                android_material_icon_name="star-border"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateText}>
                No achievements yet. Keep following your rules to unlock them!
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rewardsContainer}>
          <Text style={styles.sectionTitle}>Rewards</Text>
          {rewards.length > 0 ? (
            rewards.map((reward) => {
              const rewardDate = formatDate(reward.earnedAt);

              return (
                <View key={reward.id} style={styles.rewardCard}>
                  <View style={styles.rewardHeader}>
                    <View style={styles.rewardBadge}>
                      <Text style={styles.rewardBadgeText}>{reward.rewardType}</Text>
                    </View>
                    <Text style={styles.rewardName}>{reward.rewardName}</Text>
                  </View>
                  <Text style={styles.rewardDescription}>{reward.rewardDescription}</Text>
                  <Text style={styles.rewardDate}>Earned {rewardDate}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="gift"
                android_material_icon_name="card-giftcard"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateText}>
                No rewards yet. Complete achievements to earn rewards!
              </Text>
            </View>
          )}
        </View>

        <View style={styles.leaderboardContainer}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          {leaderboard.length > 0 ? (
            leaderboard.map((entry, index) => (
              <View key={entry.userId} style={styles.leaderboardCard}>
                <View style={[
                  styles.leaderboardRank,
                  index === 0 && { backgroundColor: '#F59E0B' },
                  index === 1 && { backgroundColor: '#94A3B8' },
                  index === 2 && { backgroundColor: '#CD7C2F' },
                ]}>
                  <Text style={styles.leaderboardRankText}>{index + 1}</Text>
                </View>
                <View style={styles.leaderboardInfo}>
                  <Text style={styles.leaderboardName}>{entry.userName || 'Anonymous'}</Text>
                  <Text style={styles.leaderboardStreak}>🔥 {entry.currentStreak} day streak</Text>
                </View>
                <Text style={styles.leaderboardPoints}>{entry.totalPoints} pts</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="list.number"
                android_material_icon_name="leaderboard"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateText}>
                No leaderboard data yet. Start checking in to compete!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
