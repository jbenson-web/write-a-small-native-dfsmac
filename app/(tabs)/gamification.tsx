
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
import { Stack, useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import * as Device from 'expo-constants';
import { IconSymbol } from '@/components/IconSymbol';
import { getGamificationWebSocket, GamificationMessage } from '@/utils/websocket';

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

interface LeaderboardPosition {
  rank: number;
  userId: string;
  totalPoints: number;
  currentStreak: number;
}

interface LiveStats {
  userStats: UserStats;
  recentAchievements: Achievement[];
  leaderboardPosition: LeaderboardPosition;
  activeUsersCount: number;
}

export default function GamificationScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardPosition, setLeaderboardPosition] = useState<LeaderboardPosition | null>(null);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [realtimeUpdate, setRealtimeUpdate] = useState<string | null>(null);
  const wsUnsubscribeRef = useRef<(() => void) | null>(null);

  const deviceId = Device.default.installationId || 'unknown';

  useEffect(() => {
    if (user) {
      console.log('[Gamification] User authenticated, fetching data');
      fetchLiveStats();
      fetchRewards();
      fetchLeaderboard();
      connectWebSocket();
    }

    return () => {
      console.log('[Gamification] Component unmounting, disconnecting WebSocket');
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current();
        wsUnsubscribeRef.current = null;
      }
      const ws = getGamificationWebSocket();
      ws.disconnect();
    };
  }, [user]);

  const connectWebSocket = useCallback(async () => {
    try {
      console.log('[Gamification] Connecting to WebSocket');
      const ws = getGamificationWebSocket();
      
      await ws.connect();
      setWsConnected(ws.isConnected());

      // Clean up previous subscription if any
      if (wsUnsubscribeRef.current) {
        wsUnsubscribeRef.current();
      }

      const unsubscribe = ws.onMessage((message: GamificationMessage) => {
        console.log('[Gamification] WebSocket message received:', message.type);
        handleWebSocketMessage(message);
      });

      wsUnsubscribeRef.current = unsubscribe;
      return unsubscribe;
    } catch (error) {
      console.error('[Gamification] WebSocket connection failed:', error);
      setWsConnected(false);
    }
  }, []);

  const handleWebSocketMessage = (message: GamificationMessage) => {
    switch (message.type) {
      case 'stats-update':
        console.log('[Gamification] Real-time stats update:', message.data);
        setStats(prev => prev ? { ...prev, ...message.data } : null);
        setRealtimeUpdate('Stats updated!');
        setTimeout(() => setRealtimeUpdate(null), 3000);
        break;

      case 'achievement-unlocked':
        console.log('[Gamification] Achievement unlocked:', message.data);
        const achievementName = message.data.achievementName || getAchievementTitle(message.data.achievementType);
        showModal('🎉 Achievement Unlocked!', achievementName);
        setRealtimeUpdate(`🏆 ${achievementName}`);
        setTimeout(() => setRealtimeUpdate(null), 5000);
        // Refresh achievements list
        fetchAchievements();
        break;

      case 'leaderboard-update':
        console.log('[Gamification] Leaderboard updated:', message.data.length, 'entries');
        setLeaderboard(message.data);
        setRealtimeUpdate('Leaderboard updated!');
        setTimeout(() => setRealtimeUpdate(null), 2000);
        break;

      case 'connected':
        console.log('[Gamification] WebSocket connected for user:', message.data.userId);
        setWsConnected(true);
        break;

      case 'error':
        console.error('[Gamification] WebSocket error:', message.data.message);
        showModal('Error', message.data.message);
        break;
    }
  };

  const fetchLiveStats = async () => {
    try {
      console.log('[Gamification] Fetching live stats from /api/gamification/live-stats');
      const liveData = await authenticatedGet<LiveStats>('/api/gamification/live-stats');
      console.log('[Gamification] Live stats fetched successfully');
      setStats(liveData.userStats);
      setAchievements(liveData.recentAchievements);
      setLeaderboardPosition(liveData.leaderboardPosition);
      setActiveUsersCount(liveData.activeUsersCount);
    } catch (error) {
      console.error('[Gamification] Failed to fetch live stats, falling back to individual endpoints:', error);
      // Fallback to individual endpoints
      await fetchGamificationData();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchGamificationData = async () => {
    try {
      console.log('[Gamification] Fetching all gamification data');
      const [statsData, achievementsData, leaderboardData] = await Promise.all([
        authenticatedGet<UserStats>('/api/gamification/stats'),
        authenticatedGet<Achievement[]>('/api/gamification/achievements'),
        authenticatedGet<LeaderboardEntry[]>('/api/gamification/leaderboard'),
      ]);

      console.log('[Gamification] Data fetched successfully');
      setStats(statsData);
      setAchievements(achievementsData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('[Gamification] Failed to fetch data:', error);
      showModal('Error', 'Failed to load gamification data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRewards = async () => {
    try {
      console.log('[Gamification] Fetching rewards');
      const rewardsData = await authenticatedGet<Reward[]>('/api/gamification/rewards');
      setRewards(rewardsData);
    } catch (error) {
      console.error('[Gamification] Failed to fetch rewards:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      console.log('[Gamification] Fetching leaderboard');
      const leaderboardData = await authenticatedGet<LeaderboardEntry[]>('/api/gamification/leaderboard');
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('[Gamification] Failed to fetch leaderboard:', error);
    }
  };

  const fetchAchievements = async () => {
    try {
      const achievementsData = await authenticatedGet<Achievement[]>('/api/gamification/achievements');
      setAchievements(achievementsData);
    } catch (error) {
      console.error('[Gamification] Failed to fetch achievements:', error);
    }
  };

  const onRefresh = () => {
    console.log('[Gamification] Manual refresh triggered');
    setRefreshing(true);
    fetchLiveStats();
    fetchRewards();
    fetchLeaderboard();
  };

  const handleCheckIn = async () => {
    if (!canCheckIn()) {
      showModal('Already Checked In', 'You have already checked in today. Come back tomorrow!');
      return;
    }

    setCheckingIn(true);
    console.log('[Gamification] Processing check-in for device:', deviceId);

    try {
      const response = await authenticatedPost<{
        success: boolean;
        pointsEarned: number;
        newAchievements: string[];
        currentStreak: number;
      }>('/api/gamification/check-in', { deviceId });

      console.log('[Gamification] Check-in successful:', response);

      const pointsText = `+${response.pointsEarned} points`;
      const streakText = `Streak: ${response.currentStreak} days`;
      const achievementText = response.newAchievements.length > 0
        ? `\n🏆 ${response.newAchievements.map(a => getAchievementTitle(a)).join(', ')}`
        : '';

      const message = `${pointsText}\n${streakText}${achievementText}`;
      showModal('Check-In Complete! ✅', message);

      // Refresh live stats to show updated data
      fetchLiveStats();
      fetchLeaderboard();
    } catch (error) {
      console.error('[Gamification] Check-in failed:', error);
      showModal('Error', 'Failed to check in. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  const getAchievementIcon = (type: string): string => {
    const icons: Record<string, string> = {
      first_rule: 'check-circle',
      week_streak: 'local-fire-department',
      month_streak: 'emoji-events',
      perfect_day: 'star',
      rule_master: 'military-tech',
    };
    return icons[type] || 'emoji-events';
  };

  const getAchievementTitle = (type: string): string => {
    const titles: Record<string, string> = {
      first_rule: 'Rule Follower',
      week_streak: 'Week Warrior',
      month_streak: 'Month Master',
      perfect_day: 'Perfect Record',
      rule_master: 'Rule Master',
    };
    return titles[type] || type;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const canCheckIn = (): boolean => {
    if (!stats?.lastCheckIn) return true;
    
    const lastCheckIn = new Date(stats.lastCheckIn);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastCheckIn.setHours(0, 0, 0, 0);
    
    return lastCheckIn.getTime() < today.getTime();
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Gamification', headerShown: true }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.text, { marginTop: 16 }]}>Loading gamification data...</Text>
      </View>
    );
  }

  const currentTheme = colorScheme === 'dark' ? 'dark' : 'light';
  const checkInButtonColor = canCheckIn() ? colors.primary : colors.textSecondary;

  return (
    <View style={commonStyles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Gamification', 
          headerShown: true,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
              <View style={[styles.wsIndicator, { backgroundColor: wsConnected ? '#4CAF50' : '#9E9E9E' }]} />
              <Text style={[commonStyles.textSecondary, { fontSize: 12, marginLeft: 4 }]}>
                {wsConnected ? 'Live' : 'Offline'}
              </Text>
            </View>
          ),
        }} 
      />

      <ScrollView
        style={commonStyles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {realtimeUpdate && (
          <View style={[styles.realtimeBanner, { backgroundColor: colors.primary }]}>
            <Text style={[styles.realtimeBannerText, { color: '#FFFFFF' }]}>
              {realtimeUpdate}
            </Text>
          </View>
        )}

        {/* Stats Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[commonStyles.title, { marginBottom: 16 }]}>Your Stats</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <IconSymbol ios_icon_name="flame.fill" android_material_icon_name="local-fire-department" size={32} color={colors.primary} />
              <Text style={[commonStyles.text, { fontSize: 24, fontWeight: 'bold', marginTop: 8 }]}>
                {stats?.currentStreak || 0}
              </Text>
              <Text style={commonStyles.textSecondary}>Current Streak</Text>
            </View>

            <View style={styles.statCard}>
              <IconSymbol ios_icon_name="star.fill" android_material_icon_name="star" size={32} color="#FFD700" />
              <Text style={[commonStyles.text, { fontSize: 24, fontWeight: 'bold', marginTop: 8 }]}>
                {stats?.totalPoints || 0}
              </Text>
              <Text style={commonStyles.textSecondary}>Total Points</Text>
            </View>

            <View style={styles.statCard}>
              <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={32} color="#4CAF50" />
              <Text style={[commonStyles.text, { fontSize: 24, fontWeight: 'bold', marginTop: 8 }]}>
                {stats?.perfectDays || 0}
              </Text>
              <Text style={commonStyles.textSecondary}>Perfect Days</Text>
            </View>

            <View style={styles.statCard}>
              <IconSymbol ios_icon_name="trophy.fill" android_material_icon_name="emoji-events" size={32} color="#FF9800" />
              <Text style={[commonStyles.text, { fontSize: 24, fontWeight: 'bold', marginTop: 8 }]}>
                {stats?.longestStreak || 0}
              </Text>
              <Text style={commonStyles.textSecondary}>Longest Streak</Text>
            </View>
          </View>

          {/* Live Stats Row */}
          {(leaderboardPosition || activeUsersCount > 0) && (
            <View style={styles.liveStatsRow}>
              {leaderboardPosition && (
                <View style={[styles.liveStatBadge, { backgroundColor: colors.primary + '20' }]}>
                  <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="leaderboard" size={16} color={colors.primary} />
                  <Text style={[commonStyles.textSecondary, { fontSize: 12, marginLeft: 4, color: colors.primary, fontWeight: 'bold' }]}>
                    Rank #{leaderboardPosition.rank}
                  </Text>
                </View>
              )}
              {activeUsersCount > 0 && (
                <View style={[styles.liveStatBadge, { backgroundColor: '#4CAF50' + '20' }]}>
                  <IconSymbol ios_icon_name="person.2.fill" android_material_icon_name="group" size={16} color="#4CAF50" />
                  <Text style={[commonStyles.textSecondary, { fontSize: 12, marginLeft: 4, color: '#4CAF50', fontWeight: 'bold' }]}>
                    {activeUsersCount} active today
                  </Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.checkInButton, { backgroundColor: checkInButtonColor }]}
            onPress={handleCheckIn}
            disabled={!canCheckIn() || checkingIn}
          >
            {checkingIn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol ios_icon_name="checkmark.circle" android_material_icon_name="check-circle" size={24} color="#FFFFFF" />
                <Text style={styles.checkInButtonText}>
                  {canCheckIn() ? 'Check In Today' : 'Already Checked In'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Achievements Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[commonStyles.title, { marginBottom: 16 }]}>Achievements</Text>
          
          {achievements.length === 0 ? (
            <Text style={commonStyles.textSecondary}>No achievements yet. Keep following your rules!</Text>
          ) : (
            achievements.map((achievement) => {
              const achievementTitle = getAchievementTitle(achievement.achievementType);
              const achievementDate = formatDate(achievement.unlockedAt);
              
              return (
                <View key={achievement.id} style={styles.achievementCard}>
                  <IconSymbol
                    ios_icon_name="trophy.fill"
                    android_material_icon_name={getAchievementIcon(achievement.achievementType)}
                    size={40}
                    color="#FFD700"
                  />
                  <View style={styles.achievementInfo}>
                    <Text style={[commonStyles.text, { fontWeight: 'bold' }]}>
                      {achievementTitle}
                    </Text>
                    <Text style={commonStyles.textSecondary}>
                      {achievementDate}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Leaderboard Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[commonStyles.title, { marginBottom: 16 }]}>Leaderboard</Text>
          
          {leaderboard.length === 0 ? (
            <Text style={commonStyles.textSecondary}>No leaderboard data yet.</Text>
          ) : (
            leaderboard.map((entry, index) => {
              const rankColor = index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : colors.text;
              const isCurrentUser = entry.userId === user?.id;
              
              return (
                <View
                  key={entry.userId}
                  style={[
                    styles.leaderboardItem,
                    isCurrentUser && { backgroundColor: colors.primary + '20' },
                  ]}
                >
                  <Text style={[commonStyles.text, { fontSize: 20, fontWeight: 'bold', color: rankColor, width: 40 }]}>
                    {index + 1}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[commonStyles.text, { fontWeight: isCurrentUser ? 'bold' : 'normal' }]}>
                      {entry.userName}
                      {isCurrentUser && ' (You)'}
                    </Text>
                    <Text style={commonStyles.textSecondary}>
                      Streak: {entry.currentStreak} days
                    </Text>
                  </View>
                  <Text style={[commonStyles.text, { fontSize: 18, fontWeight: 'bold', color: colors.primary }]}>
                    {entry.totalPoints}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* Rewards Section */}
        {rewards.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
            <Text style={[commonStyles.title, { marginBottom: 16 }]}>Rewards</Text>
            
            {rewards.map((reward) => {
              const rewardDate = formatDate(reward.earnedAt);
              
              return (
                <View key={reward.id} style={styles.rewardCard}>
                  <IconSymbol ios_icon_name="gift.fill" android_material_icon_name="card-giftcard" size={32} color={colors.primary} />
                  <View style={styles.rewardInfo}>
                    <Text style={[commonStyles.text, { fontWeight: 'bold' }]}>
                      {reward.rewardName}
                    </Text>
                    <Text style={commonStyles.textSecondary}>
                      {reward.rewardDescription}
                    </Text>
                    <Text style={[commonStyles.textSecondary, { fontSize: 12, marginTop: 4 }]}>
                      {rewardDate}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[commonStyles.title, { marginBottom: 16 }]}>
              {modalTitle}
            </Text>
            <Text style={[commonStyles.text, { marginBottom: 24, textAlign: 'center' }]}>
              {modalMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: colors.background + '80',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  checkInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: colors.background + '80',
  },
  achievementInfo: {
    flex: 1,
    marginLeft: 12,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: colors.background + '80',
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: colors.background + '80',
  },
  rewardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  wsIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  realtimeBanner: {
    padding: 12,
    margin: 16,
    marginBottom: 0,
    borderRadius: 8,
    alignItems: 'center',
  },
  realtimeBannerText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  liveStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  liveStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
});
