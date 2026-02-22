/**
 * Bottom tab navigator — 4 main sections.
 * Deep navy theme with gold active tints.
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return <Ionicons name={name} size={24} color={focused ? '#FFD700' : '#555577'} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0D1120',
          borderTopColor: '#1E2333',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#555577',
        headerStyle: { backgroundColor: '#0A0E1A' },
        headerTintColor: '#FFD700',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="squad"
        options={{
          title: 'My Squad',
          headerShown: false, // squad has its own Stack navigator
          tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} />,
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
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ focused }) => <TabIcon name="football" focused={focused} />,
        }}
      />
      {/* Hidden screens — shown via deep links, not tab bar */}
      <Tabs.Screen name="players" options={{ href: null }} />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI Coach',
          tabBarIcon: ({ focused }) => <TabIcon name="bulb" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
