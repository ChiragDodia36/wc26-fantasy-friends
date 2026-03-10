/**
 * AI Transfer Advisor screen — runs Qwen3 0.6B on-device to suggest
 * 3 player swaps with visible thinking traces.
 */
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAITransferStore } from '@/store/aiTransferStore';
import { useSquadStore } from '@/store/squadStore';
import { Colors } from '@/theme/constants';
import ThinkingTrace from '@/components/ThinkingTrace';
import TransferSwapCard from '@/components/TransferSwapCard';

export default function AITransfersScreen() {
  const squad = useSquadStore((s) => s.squad);
  const makeTransfer = useSquadStore((s) => s.makeTransfer);
  const fetchTransferAllowance = useSquadStore((s) => s.fetchTransferAllowance);

  const {
    modelReady, modelDownloading, downloadProgress,
    transferContext, loadingContext,
    inferring, thinkingText, swaps, summary, confidence, error,
    ensureModel, fetchContext, runInference, reset,
  } = useAITransferStore();

  // Ensure model is loaded on mount
  useEffect(() => {
    ensureModel();
  }, []);

  const handleAnalyze = async () => {
    if (!squad) return;
    reset();
    await fetchContext(squad.id);
    // Only run inference if context was loaded successfully
    const { transferContext: ctx, error: fetchErr } = useAITransferStore.getState();
    if (ctx && !fetchErr) {
      await runInference();
    }
  };

  const handleApplyAll = () => {
    if (swaps.length === 0) return;
    Alert.alert(
      'Apply All Transfers',
      `Execute ${swaps.length} AI-suggested transfers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const swap of swaps) {
                await makeTransfer(swap.out, swap.in);
              }
              await fetchTransferAllowance();
              Alert.alert('Done', 'All transfers applied successfully.');
            } catch (err: any) {
              Alert.alert(
                'Transfer failed',
                err?.response?.data?.detail ?? 'One or more transfers could not be applied.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>AI Transfer Advisor</Text>
      <Text style={styles.subtitle}>
        Powered by Qwen3 0.6B running locally on your device
      </Text>

      {/* Model status */}
      {modelDownloading && (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            Downloading AI model... {downloadProgress}%
          </Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${downloadProgress}%` }]} />
          </View>
        </View>
      )}

      {!modelReady && !modelDownloading && !error && (
        <View style={styles.statusBar}>
          <ActivityIndicator color={Colors.accent} size="small" />
          <Text style={[styles.statusText, { marginLeft: 8 }]}>Loading model...</Text>
        </View>
      )}

      {modelReady && (
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>Model ready</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          {error.includes('native dev build') && (
            <Text style={[styles.errorText, { marginTop: 6, opacity: 0.7 }]}>
              Run "npx expo run:ios" or "npx expo run:android" to enable on-device AI.
            </Text>
          )}
        </View>
      )}

      {/* Analyze button */}
      <Pressable
        style={[
          styles.analyzeBtn,
          (!modelReady || inferring || loadingContext) && styles.analyzeBtnDisabled,
        ]}
        onPress={handleAnalyze}
        disabled={!modelReady || inferring || loadingContext}
      >
        {inferring || loadingContext ? (
          <ActivityIndicator color={Colors.bg} size="small" />
        ) : (
          <Text style={styles.analyzeBtnText}>Analyze My Squad</Text>
        )}
      </Pressable>

      {/* Thinking trace */}
      <ThinkingTrace text={thinkingText} isStreaming={inferring} />

      {/* Swap cards — limit to 3, filter out invalid entries */}
      {swaps.length > 0 && (() => {
        const validSwaps = swaps
          .filter((s) => s.out_name && s.in_name && s.out_name !== '?' && s.in_name !== '?')
          .slice(0, 3);
        return validSwaps.length > 0 ? (
        <>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Suggested Transfers</Text>
            {confidence > 0 && (
              <Text style={styles.confidenceText}>Confidence: {confidence}%</Text>
            )}
          </View>

          {validSwaps.map((swap, i) => (
            <TransferSwapCard key={`swap-${i}`} swap={swap} index={i} />
          ))}

          {summary ? (
            <Text style={styles.summaryText}>{summary}</Text>
          ) : null}

          <Pressable style={styles.applyBtn} onPress={handleApplyAll}>
            <Text style={styles.applyBtnText}>Apply All Transfers</Text>
          </Pressable>
        </>
        ) : null;
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: 120 },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 12,
    color: '#8888AA',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141824',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  statusText: { color: '#AAAACC', fontSize: 13 },
  progressBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#2E3550',
    borderRadius: 3,
    marginLeft: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  readyBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    marginBottom: 12,
  },
  readyText: { color: Colors.lime, fontSize: 12, fontWeight: '600' },
  errorBar: {
    backgroundColor: '#2A1A1A',
    borderLeftWidth: 3,
    borderLeftColor: '#FF4444',
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 6,
  },
  errorText: { color: '#FF9999', fontSize: 13 },
  analyzeBtn: {
    backgroundColor: Colors.accent,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  analyzeBtnDisabled: { opacity: 0.5 },
  analyzeBtnText: {
    color: Colors.bg,
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  confidenceText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
  },
  summaryText: {
    color: '#AAAACC',
    fontSize: 13,
    lineHeight: 20,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  applyBtn: {
    backgroundColor: '#1A2A1A',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
    marginTop: 8,
  },
  applyBtnText: {
    color: Colors.lime,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
