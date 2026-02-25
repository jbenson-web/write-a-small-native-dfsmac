
import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

export default function TabLayout() {
  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)/',
      icon: 'house.fill',
      label: 'Monitor',
    },
    {
      name: 'rules',
      route: '/(tabs)/rules',
      icon: 'shield.fill',
      label: 'Rules',
    },
    {
      name: 'devices',
      route: '/(tabs)/devices',
      icon: 'iphone',
      label: 'Devices',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile',
      icon: 'person.circle.fill',
      label: 'Profile',
    },
  ];

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="rules" name="rules" />
        <Stack.Screen key="devices" name="devices" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
