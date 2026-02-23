/**
 * AI Coach screen — Tree of Thought branch cards (Safe / Differential / Fixture)
 * plus a rules Q&A chat section.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '@/services/api';
import { ToTBranchCard } from '@/components/ToTBranchCard';
import type { ToTBranchCard as ToTBranchData } from '@/types/ai';

/** Raw backend AI response shape */
interface AIResponse {
  explanation: string;
  data: unknown;
}

interface QAMessage {
  role: 'user' | 'assistant';
  text: string;
}

const MOCK_BRANCHES: ToTBranchData[] = [
  {
    branch: 'safe',
    title: 'High-ceiling consistent picks',
    reasoning:
      'Focus on premium attackers from strong group-stage teams with high xG and recent international form. Captain the most nailed striker from a group favourite.',
    recommendedPlayerIds: [],
    captainId: '',
    confidencePct: 78,
  },
  {
    branch: 'differential',
    title: 'Under-owned dark horse picks',
    reasoning:
      'Target low-ownership players from mid-tier teams who could over-perform their odds. Higher variance but potential for big rank swings in your league.',
    recommendedPlayerIds: [],
    captainId: '',
    confidencePct: 52,
  },
  {
    branch: 'fixture',
    title: 'Easy fixture route picks',
    reasoning:
      'Prioritise players facing the weakest Group Stage opponents (FDR 1–2). Stack defenders and goalkeepers from teams with favourable opening fixtures.',
    recommendedPlayerIds: [],
    captainId: '',
    confidencePct: 65,
  },
];

export default function AICoachScreen() {
  const router = useRouter();

  // ToT branches
  const [branches, setBranches] = useState<ToTBranchData[]>(MOCK_BRANCHES);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Q&A chat
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Fetch real branches from backend (falls back to mock if backend returns stub)
  const fetchBranches = useCallback(async () => {
    setLoadingBranches(true);
    try {
      const res = await api.post<AIResponse>('/ai/squad-builder', {
        league_id: 'default',
        budget: 100,
        preferred_formation: '4-3-3',
        risk_profile: 'balanced',
      });
      const payload = res.data.data;
      if (payload && Array.isArray(payload)) {
        // Backend returned real ToT branches
        const parsed = payload as ToTBranchData[];
        if (parsed.length > 0) setBranches(parsed);
      }
    } catch {
      // Keep mock branches on error
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleApply = (data: ToTBranchData) => {
    setSelectedBranch(data.branch);
    // Navigate to transfers with pre-selected recommendations
    router.push('/(tabs)/squad/transfers');
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg: QAMessage = { role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await api.post<AIResponse>('/ai/qa', {
        league_id: 'default',
        question: trimmed,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res.data.explanation },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Sorry, I could not get an answer right now. Try again later.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <Text style={styles.heading}>AI Coach</Text>
        <Text style={styles.subheading}>
          Tree of Thought analysis — three strategies ranked by confidence.
        </Text>

        {/* ToT Branch Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strategy Branches</Text>
          {loadingBranches ? (
            <ActivityIndicator color="#FFD700" size="large" style={{ marginVertical: 24 }} />
          ) : (
            branches.map((b) => (
              <ToTBranchCard
                key={b.branch}
                data={b}
                isSelected={selectedBranch === b.branch}
                onApply={handleApply}
              />
            ))
          )}
        </View>

        {/* Refresh */}
        <Pressable style={styles.refreshBtn} onPress={fetchBranches} disabled={loadingBranches}>
          <Text style={styles.refreshText}>
            {loadingBranches ? 'Analysing...' : 'Refresh Analysis'}
          </Text>
        </Pressable>

        {/* Q&A Chat */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ask the Coach</Text>
          <Text style={styles.chatHint}>
            Ask about rules, scoring, strategy, or player comparisons.
          </Text>

          {messages.map((msg, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  msg.role === 'user' ? styles.userBubbleText : styles.assistantBubbleText,
                ]}
              >
                {msg.text}
              </Text>
            </View>
          ))}

          {sending && (
            <View style={[styles.bubble, styles.assistantBubble]}>
              <ActivityIndicator color="#FFD700" size="small" />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask a question..."
          placeholderTextColor="#8888AA"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!sending}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { padding: 20, paddingBottom: 100, gap: 16 },
  heading: { fontSize: 28, fontWeight: 'bold', color: '#FFD700' },
  subheading: { fontSize: 14, color: '#8888AA', lineHeight: 20 },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#8888AA',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  refreshBtn: {
    backgroundColor: '#1E2A4A',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  refreshText: { color: '#FFD700', fontSize: 15, fontWeight: '600' },
  chatHint: { fontSize: 13, color: '#555577' },
  bubble: {
    borderRadius: 12,
    padding: 12,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#1E2A4A',
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: '#141824',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userBubbleText: { color: '#FFFFFF' },
  assistantBubbleText: { color: '#CCCCDD' },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E2333',
    backgroundColor: '#0A0E1A',
  },
  input: {
    flex: 1,
    backgroundColor: '#1E2333',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2E3550',
  },
  sendBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#0A0E1A', fontWeight: 'bold', fontSize: 15 },
});
