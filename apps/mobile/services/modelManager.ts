/**
 * Model download manager for the on-device Qwen3 0.6B GGUF model.
 * Downloads from HuggingFace on first launch with resume support.
 */
import * as FileSystem from 'expo-file-system/legacy';

const MODEL_FILENAME = 'Qwen_Qwen3-0.6B-Q4_K_M.gguf';
const MODEL_URL =
  'https://huggingface.co/bartowski/Qwen_Qwen3-0.6B-GGUF/resolve/main/Qwen_Qwen3-0.6B-Q4_K_M.gguf';
const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
const MODEL_PATH = `${MODEL_DIR}${MODEL_FILENAME}`;

/** Check whether the GGUF file already exists on disk. */
export async function isModelDownloaded(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  return info.exists && !!(info as any).size;
}

/** Return the absolute path to the downloaded model. */
export function getModelPath(): string {
  return MODEL_PATH;
}

/**
 * Download the model with progress updates and resume support.
 * Creates the models/ directory if it doesn't exist.
 */
export async function downloadModel(
  onProgress: (pct: number) => void,
): Promise<string> {
  // Ensure models directory exists
  const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    MODEL_URL,
    MODEL_PATH,
    {},
    (progress) => {
      const pct =
        progress.totalBytesExpectedToWrite > 0
          ? Math.round(
              (progress.totalBytesWritten /
                progress.totalBytesExpectedToWrite) *
                100,
            )
          : 0;
      onProgress(pct);
    },
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('Model download failed — no URI returned.');
  }
  return result.uri;
}
