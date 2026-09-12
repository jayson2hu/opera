import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appendDraftVersion, copyDraft, isWorkspaceRecord, writeDraftRecord } from '../lib/draftWorkspace';
import type { DraftSession, DraftValue, DraftVersion } from '../lib/draftWorkspace';
import { DRAFT_FLUSH_EVENT } from '../lib/draftPersistence';
import { recordCreationActivity } from '../lib/creationActivity';
import { notifyDraftsChanged } from './useRecentDrafts';

export interface DraftWorkspace {
  id: string;
  status: 'saved' | 'saving' | 'error';
  error: string | null;
  versions: DraftVersion[];
  checkpoint: (label?: string) => boolean;
  flush: () => boolean;
  exportBackup: () => void;
}
export function useDraftWorkspace(session: DraftSession, value: DraftValue): DraftWorkspace {
  const serialized = JSON.stringify(value);
  const [savedValue, setSavedValue] = useState('');
  const [error, setError] = useState<string | null>(session.readError ?? null);
  const [versions, setVersions] = useState(session.versions);
  const valueRef = useRef(value);
  const versionsRef = useRef(versions);
  const revisionRef = useRef(session.revision);
  const savedRef = useRef('');
  const pointerSavedRef = useRef(false);
  useLayoutEffect(() => { valueRef.current = value; }, [value]);
  const flush = useCallback(() => {
    const next = valueRef.current, fingerprint = JSON.stringify(next);
    if (savedRef.current === fingerprint && revisionRef.current > 0 && pointerSavedRef.current) {
      try {
        const raw = window.localStorage.getItem(session.id);
        const stored: unknown = raw ? JSON.parse(raw) : null;
        if (isWorkspaceRecord(stored) && stored.revision === revisionRef.current) return true;
      } catch { /* Continue into the visible error path below. */ }
    }
    const history = versionsRef.current.length ? versionsRef.current : appendDraftVersion([], next, '初始稿件');
    const outcome = writeDraftRecord(session, next, history, revisionRef.current);
    if (!outcome.ok) { setError(outcome.error); return false; }
    pointerSavedRef.current = outcome.pointerSaved;
    revisionRef.current = outcome.record.revision; savedRef.current = fingerprint; versionsRef.current = history;
    setVersions(history); setSavedValue(fingerprint);
    setError(outcome.pointerSaved ? null : '稿件已保存，但索引或迁移标记未更新；请重试保存或导出备份。');
    try {
      if ((typeof next.topic === 'string' && next.topic.trim()) || (typeof next.inputText === 'string' && next.inputText.trim()) || next.result) {
        recordCreationActivity({ storage: window.localStorage, kind: session.kind, at: new Date() });
      }
    } catch { /* Saving text succeeds independently of activity statistics. */ }
    notifyDraftsChanged(); return outcome.pointerSaved;
  }, [session]);
  const checkpoint = useCallback((label = '手动保存版本') => {
    const nextVersions = appendDraftVersion(versionsRef.current, valueRef.current, label);
    if (nextVersions !== versionsRef.current) {
      versionsRef.current = nextVersions; setVersions(nextVersions); savedRef.current = '';
    }
    return flush();
  }, [flush]);
  useEffect(() => {
    const timer = window.setTimeout(flush, 1500);
    return () => window.clearTimeout(timer);
  }, [flush, serialized]);
  useEffect(() => {
    const beforeLeave = (event: Event) => {
      if (!flush()) { event.preventDefault(); if (event.type === 'beforeunload') (event as BeforeUnloadEvent).returnValue = ''; }
    };
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener(DRAFT_FLUSH_EVENT, beforeLeave); window.addEventListener('beforeunload', beforeLeave);
    window.addEventListener('pagehide', beforeLeave); document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener(DRAFT_FLUSH_EVENT, beforeLeave); window.removeEventListener('beforeunload', beforeLeave);
      window.removeEventListener('pagehide', beforeLeave); document.removeEventListener('visibilitychange', hidden);
    };
  }, [flush]);
  const exportBackup = useCallback(() => {
    const backup = { schemaVersion: 2, id: session.id, kind: session.kind,
      value: copyDraft(valueRef.current), versions: copyDraft(versionsRef.current),
      ...(session.readError ? { unreadableOriginal: copyDraft(session.initialValue) } : {}), exportedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = session.kind + '-draft-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [session]);
  return { id: session.id, versions, flush, checkpoint, exportBackup, error,
    status: error ? 'error' : savedValue === serialized ? 'saved' : 'saving' };
}
