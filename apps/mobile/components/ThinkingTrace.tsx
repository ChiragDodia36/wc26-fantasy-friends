/**
 * ThinkingTrace — displays the AI's chain-of-thought reasoning in real-time.
 * Auto-scrolls as tokens arrive. Collapsible with a toggle button.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/theme/constants';

interface Props {
  text: string;
  isStreaming: boolean;
  collapsed?: boolean;
}

export default function ThinkingTrace({ text, isStreaming, collapsed: initialCollapsed }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false);

  useEffect(() => {
    if (!collapsed) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [text, collapsed]);

  if (!text && !isStreaming) return null;

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setCollapsed(!collapsed)}>
        <Text style={styles.headerText}>
          {isStreaming ? 'Thinking...' : 'AI Reasoning'}
        </Text>
        <Text style={styles.toggle}>{collapsed ? 'Show' : 'Hide'}</Text>
      </Pressable>

      {!collapsed && (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.traceText}>
            {text}
            {isStreaming && <Text style={styles.cursor}>|</Text>}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141824',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#2E3550',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1A1F30',
  },
  headerText: {
    color: '#8888AA',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toggle: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    maxHeight: 200,
  },
  scrollContent: {
    padding: 14,
  },
  traceText: {
    color: '#AAAACC',
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  cursor: {
    color: Colors.accent,
    fontWeight: 'bold',
  },
});
