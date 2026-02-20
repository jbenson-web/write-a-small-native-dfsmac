
import { StyleSheet } from 'react-native';

export const colors = {
  // Device monitoring theme - tech blue and security green
  background: '#F8FAFC',
  backgroundDark: '#0F172A',
  
  text: '#1E293B',
  textDark: '#F1F5F9',
  
  textSecondary: '#64748B',
  textSecondaryDark: '#94A3B8',
  
  primary: '#3B82F6', // Blue for monitoring
  primaryDark: '#60A5FA',
  
  secondary: '#10B981', // Green for active/safe
  secondaryDark: '#34D399',
  
  accent: '#F59E0B', // Amber for warnings
  accentDark: '#FBBF24',
  
  card: '#FFFFFF',
  cardDark: '#1E293B',
  
  highlight: '#EFF6FF',
  highlightDark: '#1E3A8A',
  
  danger: '#EF4444',
  dangerDark: '#F87171',
  
  border: '#E2E8F0',
  borderDark: '#334155',
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
