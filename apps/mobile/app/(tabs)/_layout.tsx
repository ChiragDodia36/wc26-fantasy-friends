/**
 * Bottom tab navigator — 6 main sections.
 * Frosted glass tab bar with gold active indicator.
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/theme/constants';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={22} color={focused ? Colors.accent : Colors.textDim} />
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

function TabBarBackground() {
  return (
    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
      <View style={styles.tabBarOverlay} />
    </BlurView>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 88,
          paddingBottom: 28,
          elevation: 0,
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textDim,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.accent,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="squad"
        options={{
          title: 'Squad',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ focused }) => <TabIcon name="football" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="my-squad"
        options={{
          title: 'My XI',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="shirt-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'Leagues',
          tabBarIcon: ({ focused }) => <TabIcon name="trophy" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => <TabIcon name="ellipsis-horizontal" focused={focused} />,
        }}
      />
      {/* Hidden — accessible via More → AI Coach, not shown in tab bar */}
      <Tabs.Screen name="ai" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
  tabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,13,31,0.88)',
  },
});
