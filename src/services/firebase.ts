import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  DetectionJobResult,
  ExperimentComparisonItem,
  FeatureSetType,
  ModelType,
  SplitStrategyType,
  TransformType,
} from '../types/ldos';

import defaultFirebaseConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIRESTORE_DATABASE_ID || defaultFirebaseConfig.firestoreDatabaseId,
};

// Initialize Firebase for project "ldos-attack-detector" with provisioned Firestore database
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Initialize Analytics safely in browser environments
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    })
    .catch(() => {});
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const MAX_ID_LEN = 128;
const MAX_EXP_NAME_LEN = 120;
const MAX_JOB_ID_LEN = 64;
const MAX_FILENAME_LEN = 200;

function sanitizeSafeId(raw: string, maxLen = MAX_ID_LEN): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export function getWorkspaceSessionId(): string {
  const key = 'ldos_workspace_session_id';
  try {
    const existing = localStorage.getItem(key);
    if (existing && ID_REGEX.test(existing) && existing.length <= MAX_ID_LEN) {
      return existing;
    }
    const created = `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, created);
    return created;
  } catch {
    return 'ws_default_academic_session';
  }
}

function clampProb(val: number): number {
  if (Number.isNaN(val)) return 0;
  return Math.max(0, Math.min(1, Number(val.toFixed(4))));
}

function clampCount(val: number): number {
  if (Number.isNaN(val)) return 0;
  return Math.max(0, Math.min(1000000, Math.round(val)));
}

export async function saveExperimentToFirestore(
  res: DetectionJobResult,
  experimentName: string
): Promise<void> {
  const sessionId = getWorkspaceSessionId();
  if (!ID_REGEX.test(sessionId) || sessionId.length > MAX_ID_LEN) return;

  const safeDatasetName = (res.datasetSummary.filename || 'dataset.csv').slice(0, MAX_FILENAME_LEN);
  const safeExpName = (experimentName || 'LDoS Detection Run').slice(0, MAX_EXP_NAME_LEN);
  const safeJobId = sanitizeSafeId(res.jobId, MAX_JOB_ID_LEN);

  const docId = sanitizeSafeId(
    `${sessionId.slice(0, 32)}_${res.config.transform}_${res.config.featureSet}_${res.config.model}`,
    MAX_ID_LEN
  );

  const path = `experiments/${docId}`;
  const payload = {
    sessionId,
    experimentName: safeExpName,
    jobId: safeJobId,
    datasetFilename: safeDatasetName,
    transform: res.config.transform,
    featureSet: res.config.featureSet,
    featureCount: res.config.featureSet === 'original_4' ? 4 : 6,
    model: res.config.model,
    splitStrategy: res.config.splitStrategy,
    accuracy: clampProb(res.metrics.accuracy),
    precision: clampProb(res.metrics.precision),
    recall: clampProb(res.metrics.recall),
    specificity: clampProb(res.metrics.specificity),
    f1Score: clampProb(res.metrics.f1Score),
    fpr: clampProb(res.metrics.fpr),
    tp: clampCount(res.metrics.confusionMatrix.tp),
    tn: clampCount(res.metrics.confusionMatrix.tn),
    fp: clampCount(res.metrics.confusionMatrix.fp),
    fn: clampCount(res.metrics.confusionMatrix.fn),
    totalWindowsCount: clampCount(res.metrics.totalWindowsCount),
    normalWindowsCount: clampCount(res.metrics.normalWindowsCount),
    ldosWindowsCount: clampCount(res.metrics.ldosWindowsCount),
    overallVerdict: res.metrics.overallVerdict,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'experiments', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteExperimentFromFirestore(experimentId: string): Promise<void> {
  const safeId = sanitizeSafeId(experimentId, MAX_ID_LEN);
  const path = `experiments/${safeId}`;
  try {
    await deleteDoc(doc(db, 'experiments', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToSessionExperiments(
  onUpdate: (items: ExperimentComparisonItem[]) => void
): () => void {
  const sessionId = getWorkspaceSessionId();
  const path = 'experiments';
  const q = query(collection(db, path), where('sessionId', '==', sessionId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ExperimentComparisonItem[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const acc = Number(d.accuracy || 0);
        // Automatically purge any legacy 100% accuracy entries from earlier test runs
        if (acc >= 0.995) {
          deleteDoc(doc(db, 'experiments', docSnap.id)).catch(() => {});
          return;
        }
        const createdAtTs = d.createdAt as Timestamp | null;
        const isoTime = createdAtTs?.toDate
          ? createdAtTs.toDate().toISOString()
          : new Date().toISOString();

        items.push({
          experimentId: docSnap.id,
          experimentName: String(d.experimentName || 'Experiment'),
          isPaperBaseline:
            d.transform === 'FSWT' &&
            d.featureSet === 'original_4' &&
            d.model === 'decision_tree',
          jobId: String(d.jobId || docSnap.id),
          datasetFilename: String(d.datasetFilename || 'dataset.csv'),
          transform: (d.transform as TransformType) || 'FSWT',
          featureSet: (d.featureSet as FeatureSetType) || 'original_4',
          featureCount: Number(d.featureCount) === 6 ? 6 : 4,
          model: (d.model as ModelType) || 'decision_tree',
          splitStrategy: (d.splitStrategy as SplitStrategyType) || 'stratified',
          accuracy: acc,
          precision: Number(d.precision || 0),
          recall: Number(d.recall || 0),
          specificity: Number(d.specificity || 0),
          f1Score: Number(d.f1Score || 0),
          fpr: Number(d.fpr || 0),
          confusionMatrix: {
            tp: Number(d.tp || 0),
            tn: Number(d.tn || 0),
            fp: Number(d.fp || 0),
            fn: Number(d.fn || 0),
          },
          executedAt: isoTime,
        });
      });

      items.sort((a, b) => a.experimentName.localeCompare(b.experimentName));
      onUpdate(items);
    },
    (error) => {
      // Log quietly if the user's external project rules haven't been published yet
      console.warn('Firestore subscription notice:', error.message);
    }
  );
}
