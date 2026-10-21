'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import CharacterBrowser from '../components/CharacterBrowser';
import SettingsModal from '../components/SettingsModal';
import CreateCharacterModal from '../components/CreateCharacterModal';
import UserRoleModal from '../components/UserRoleModal';
import AuthGate from '../components/AuthGate';
import Toast from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { normalizeUserRole, mergeUserProfile, USER_ROLE_FIELDS } from '../lib/userRole';
import { normalizeRealism } from '../constants/scenario';
import { stripTrailingPartialTag, finalizeReply, latestScene } from '../lib/scene';
import { DEFAULT_CHARACTERS } from '../constants/characters';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../constants/models';
import {
  DEFAULT_RESPONSE_SETTINGS,
  HISTORY_CHAR_BUDGET,
  FIRST_RESPONSE_CLIENT_TIMEOUT_MS,
  STALL_TIMEOUT_MS,
  normalizeResponseSettings,
} from '../constants/chatSettings';

// Last-activity time per character chat, for the sidebar's chat list. Histories saved before this
// existed have no entry, so they are picked up from storage with time 0 (listed as older chats).
function readChatActivity(store) {
  let activity = {};
  try {
    activity = JSON.parse(store.getItem('user_chat_activity')) || {};
  } catch (err) {
    console.error('Failed to parse chat activity from storage:', err);
  }
  for (const key of store.keys()) {
    if (key.startsWith('chat_history_')) {
      const id = key.slice('chat_history_'.length);
      if (!(id in activity)) activity[id] = 0;
    }
  }
  return activity;
}

// One-line preview of a chat's last message, with *(action)* narration removed
function lastMessagePreview(store, charId) {
  try {
    const history = JSON.parse(store.getItem(`chat_history_${charId}`) || '[]');
    const last = history[history.length - 1];
    if (!last?.text) return '';
    const text = last.text.replace(/\*\([^)]*\)\*/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    return last.role === 'user' ? `คุณ: ${text}` : text;
  } catch {
    return '';
  }
}

// What the chat shows when a reply can't be had, by the `kind` /api/chat returns (plus 'network' for a failed fetch)
const REPLY_ERRORS = {
  busy: { kind: 'error', title: 'ส่งข้อความไม่สำเร็จ', text: 'ตอนนี้ระบบ AI ของ Google คนใช้เยอะ ลองส่งอีกครั้งในอีกสักครู่' },
  quota: {
    kind: 'error',
    title: 'วันนี้คุยกันจนโควต้าฟรีหมดแล้ว',
    text: 'โควต้าจะกลับมาประมาณบ่าย 2–3 โมง (เวลาไทย) หรือใส่ Gemini API Key อื่นในตั้งค่า',
    retry: false,
  },
  network: { kind: 'error', title: 'เชื่อมต่อไม่ได้', text: 'ตรวจอินเทอร์เน็ตแล้วลองส่งอีกครั้ง' },
  signin: { kind: 'error', title: 'ต้องเข้าสู่ระบบใหม่', text: 'ออกจากระบบแล้วเข้าสู่ระบบอีกครั้ง', retry: false },
  auth: { kind: 'error', title: 'Gemini API Key ใช้ไม่ได้', text: 'ตรวจ key ในหน้าตั้งค่า หรือในไฟล์ .env.local', retry: false },
};

// Newest messages that fit in `budget` characters; always keeps at least the latest message.
function takeRecentMessages(messages, budget) {
  const recent = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    used += messages[i].text.length;
    if (recent.length > 0 && used > budget) break;
    recent.unshift({ role: messages[i].role, text: messages[i].text });
  }
  return recent;
}

function RoleplayApp({ store, account, getAccessToken }) {
  const [characters, setCharacters] = useState(DEFAULT_CHARACTERS);
  const [selectedChar, setSelectedChar] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [userProfile, setUserProfile] = useState({ name: '', callMe: '', description: '' });
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [responseSettings, setResponseSettings] = useState(DEFAULT_RESPONSE_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChar, setEditingChar] = useState(null);
  const [userRoles, setUserRoles] = useState({});
  const [notice, setNotice] = useState(null);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);
  const [confirmDialog, askConfirm] = useConfirm();
  const [showUserRole, setShowUserRole] = useState(false);
  const [chatActivity, setChatActivity] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef(null);
  const activeCharIdRef = useRef(null); // which character's chat is currently on screen

  // Load saved API key, custom characters, and user persona profile on mount
  useEffect(() => {
    const savedKey = store.getItem('user_gemini_api_key');
    if (savedKey) setApiKey(savedKey);

    const savedModel = store.getItem('user_gemini_model');
    if (AVAILABLE_MODELS.some((m) => m.id === savedModel)) setModel(savedModel);

    const savedChars = store.getItem('user_custom_chars');
    if (savedChars) {
      try {
        const parsed = JSON.parse(savedChars);
        setCharacters([...DEFAULT_CHARACTERS, ...parsed]);
      } catch (err) {
        console.error('Failed to parse custom characters from storage:', err);
      }
    }

    try {
      const savedSettings = JSON.parse(store.getItem('user_response_settings'));
      if (savedSettings) setResponseSettings(normalizeResponseSettings(savedSettings));
    } catch (err) {
      console.error('Failed to parse response settings from storage:', err);
    }

    try {
      const savedRoles = JSON.parse(store.getItem('user_character_roles'));
      if (savedRoles && typeof savedRoles === 'object') {
        setUserRoles(
          Object.fromEntries(Object.entries(savedRoles).map(([id, role]) => [id, normalizeUserRole(role)]))
        );
      }
    } catch (err) {
      console.error('Failed to parse character roles from storage:', err);
    }

    setChatActivity(readChatActivity(store));

    const savedProfile = store.getItem('user_roleplay_profile');
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
      } catch (err) {
        console.error('Failed to parse user profile from storage:', err);
      }
    }
  }, []);

  // Save updated API key
  const handleSaveApiKey = (newKey) => {
    setApiKey(newKey);
    store.setItem('user_gemini_api_key', newKey);
  };

  // Save selected Gemini model
  const handleSaveModel = (newModel) => {
    setModel(newModel);
    store.setItem('user_gemini_model', newModel);
  };

  const handleSaveResponseSettings = (settings) => {
    const normalized = normalizeResponseSettings(settings);
    setResponseSettings(normalized);
    store.setItem('user_response_settings', JSON.stringify(normalized));
  };

  // Save (or clear, when every field is empty) the user's role for one character
  const handleSaveUserRole = (charId, role) => {
    setUserRoles((prev) => {
      const next = { ...prev };
      if (USER_ROLE_FIELDS.some((f) => role[f]?.trim())) next[charId] = role;
      else delete next[charId];
      store.setItem('user_character_roles', JSON.stringify(next));
      return next;
    });
  };

  // Save updated user persona profile
  const handleSaveUserProfile = (profile) => {
    setUserProfile(profile);
    store.setItem('user_roleplay_profile', JSON.stringify(profile));
  };

  const writeChatActivity = (update) => {
    setChatActivity((prev) => {
      const next = update({ ...prev });
      store.setItem('user_chat_activity', JSON.stringify(next));
      return next;
    });
  };

  const saveHistory = (charId, history) => {
    store.setItem(`chat_history_${charId}`, JSON.stringify(history));
    writeChatActivity((next) => ({ ...next, [charId]: Date.now() }));
  };

  // Forget a chat entirely: its history and its place in the sidebar's chat list
  const dropChat = (charId) => {
    store.removeItem(`chat_history_${charId}`);
    writeChatActivity((next) => {
      delete next[charId];
      return next;
    });
  };

  const recentChats = useMemo(
    () =>
      characters
        .filter((c) => c.id in chatActivity)
        .map((c) => ({ character: c, at: chatActivity[c.id], preview: lastMessagePreview(store, c.id) }))
        .sort((a, b) => b.at - a.at),
    [store, characters, chatActivity]
  );

  // Cancel the in-flight reply. `discard` skips saving the partial reply (history cleared or character deleted).
  const stopStreaming = ({ discard = false } = {}) => {
    setNotice(null);
    if (!abortRef.current) return;
    abortRef.current.discard = discard;
    abortRef.current.abort();
    abortRef.current = null;
    setLoading(false);
  };

  // The role form opens by itself only the first time a character is opened; returns true that one time.
  const markRolePrompted = (charId) => {
    try {
      const prompted = JSON.parse(store.getItem('user_role_prompted') || '[]');
      if (prompted.includes(charId)) return false;
      store.setItem('user_role_prompted', JSON.stringify([...prompted, charId]));
      return true;
    } catch {
      return false;
    }
  };

  // Switch character and load their respective conversation history
  const handleSelectChar = (char) => {
    stopStreaming();
    setShowHistory(false);
    activeCharIdRef.current = char.id;
    setSelectedChar(char);
    if (!userRoles[char.id] && markRolePrompted(char.id)) setShowUserRole(true);
    const savedHistory = store.getItem(`chat_history_${char.id}`);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch (err) {
        console.error('Failed to parse chat history:', err);
      }
    }
    setMessages([{ role: 'model', text: char.greeting }]);
  };

  const handleBack = () => {
    stopStreaming();
    setShowHistory(false);
    activeCharIdRef.current = null;
    setSelectedChar(null);
  };

  // Stream a reply for `baseMessages`, which must end with the user message being answered.
  const streamReply = async (baseMessages) => {
    if (loading || !selectedChar) return;

    const charId = selectedChar.id;
    const userMessage = baseMessages[baseMessages.length - 1].text;
    setMessages(baseMessages);
    saveHistory(charId, baseMessages);
    setLoading(true);
    setNotice(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulatedText = '';

    // Abort if the model goes quiet: `ms` without a response (first call) or without a new chunk (later calls)
    let stallTimer;
    const armStallTimer = (ms) => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        controller.stalled = true;
        controller.abort();
      }, ms);
    };
    armStallTimer(FIRST_RESPONSE_CLIENT_TIMEOUT_MS);

    try {
      const historyPayload = takeRecentMessages(baseMessages, HISTORY_CHAR_BUDGET);
      const accessToken = await getAccessToken();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: userMessage,
          history: historyPayload.slice(0, -1),
          persona: selectedChar,
          apiKey: apiKey,
          model: model,
          responseSettings: responseSettings,
          userProfile: mergeUserProfile(userProfile, userRoles[charId]),
          scene: latestScene(baseMessages) || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const error = new Error(errorData.error || `HTTP ${res.status}`);
        error.kind = errorData.kind;
        throw error;
      }

      armStallTimer(STALL_TIMEOUT_MS);

      // Add empty placeholder for the incoming stream; `loading` stays true so the input stays locked.
      // Skipped (like every UI update below) when the user has already switched to another chat.
      if (activeCharIdRef.current === charId) {
        setMessages((prev) => [...prev, { role: 'model', text: '' }]);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        armStallTimer(STALL_TIMEOUT_MS);
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        if (activeCharIdRef.current !== charId) continue;

        setMessages((prev) => {
          const nextState = [...prev];
          const lastIndex = nextState.length - 1;
          if (lastIndex >= 0 && nextState[lastIndex].role === 'model') {
            nextState[lastIndex] = { ...nextState[lastIndex], text: stripTrailingPartialTag(accumulatedText) };
          }
          return nextState;
        });
      }
    } catch (err) {
      const failed = !controller.signal.aborted;
      if ((failed || controller.userStopped || controller.stalled) && !accumulatedText && activeCharIdRef.current === charId) {
        // Drop the empty placeholder bubble; keep any partial reply already received
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return last?.role === 'model' && !last.text ? prev.slice(0, -1) : prev;
        });
      }
      if (activeCharIdRef.current === charId) {
        if (controller.stalled) {
          setNotice(
            accumulatedText
              ? { kind: 'warn', title: 'ข้อความขาดหายกลางทาง', text: 'เก็บส่วนที่ได้ไว้แล้ว กด "สร้างคำตอบใหม่" ถ้าอยากได้คำตอบเต็ม' }
              : { ...REPLY_ERRORS.busy, retry: true }
          );
        } else if (failed) {
          const known = REPLY_ERRORS[err.kind] || (err instanceof TypeError ? REPLY_ERRORS.network : REPLY_ERRORS.busy);
          setNotice({ ...known, detail: err.message, retry: !accumulatedText && known.retry !== false });
        }
      }
    } finally {
      clearTimeout(stallTimer);
      if (accumulatedText && !controller.discard) {
        const { cleanText, scene } = finalizeReply(accumulatedText);
        saveHistory(charId, [...baseMessages, { role: 'model', text: cleanText, scene }]);
        // Only touch the currently displayed chat if it's still this one (the user may have switched away)
        if (activeCharIdRef.current === charId) {
          setMessages((prev) => {
            const nextState = [...prev];
            const lastIndex = nextState.length - 1;
            if (lastIndex >= 0 && nextState[lastIndex].role === 'model') {
              nextState[lastIndex] = { ...nextState[lastIndex], text: cleanText, scene };
            }
            return nextState;
          });
        }
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  // Send message and stream response from Gemini API
  const handleSendMessage = () => {
    if (!input.trim() || loading || !selectedChar) return;

    const userMessage = input.trim();
    setInput('');
    streamReply([...messages, { role: 'user', text: userMessage }]);
  };

  // Stop the reply the user is waiting for; whatever text has arrived is kept
  const handleStopReply = () => {
    if (abortRef.current) abortRef.current.userStopped = true;
    stopStreaming();
  };

  // Resend the last user message when it never got a reply
  const handleRetry = () => {
    if (loading) return;
    if (messages[messages.length - 1]?.role === 'user') streamReply(messages);
  };

  // Replace the last model reply with a freshly generated one
  const handleRegenerate = () => {
    if (loading) return;
    const last = messages[messages.length - 1];
    if (last?.role !== 'model' || !messages.slice(0, -1).some((m) => m.role === 'user')) return;
    streamReply(messages.slice(0, -1));
  };

  const persistMessages = (next) => {
    setMessages(next);
    if (selectedChar) saveHistory(selectedChar.id, next);
  };

  // Edit a message in place. Editing a user message drops everything after it and asks for a new reply.
  const handleEditMessage = (index, text) => {
    const trimmed = text.trim();
    if (loading || !trimmed || !messages[index]) return;
    if (messages[index].role === 'user') {
      streamReply([...messages.slice(0, index), { role: 'user', text: trimmed }]);
    } else {
      persistMessages(messages.map((m, i) => (i === index ? { ...m, text: trimmed } : m)));
    }
  };

  const handleDeleteMessage = (index) => {
    if (loading || messages.length <= 1) return;
    persistMessages(messages.filter((_, i) => i !== index));
  };

  // Create and persist a new custom persona
  const handleCreateCharacter = (formData) => {
    const created = {
      ...formData,
      id: `custom_${Date.now()}`,
      realism: normalizeRealism(formData.realism),
    };

    const existing = JSON.parse(store.getItem('user_custom_chars') || '[]');
    const updatedCustoms = [...existing, created];
    store.setItem('user_custom_chars', JSON.stringify(updatedCustoms));

    setCharacters([...DEFAULT_CHARACTERS, ...updatedCustoms]);
    activeCharIdRef.current = created.id;
    setSelectedChar(created);
    setMessages([{ role: 'model', text: created.greeting }]);
  };

  // Update an existing custom persona in place, keeping its id and chat history
  const handleUpdateCharacter = (formData) => {
    const sanitized = { ...formData, realism: normalizeRealism(formData.realism) };
    const existing = JSON.parse(store.getItem('user_custom_chars') || '[]');
    const updatedCustoms = existing.map((c) => (c.id === sanitized.id ? { ...c, ...sanitized } : c));
    store.setItem('user_custom_chars', JSON.stringify(updatedCustoms));

    setCharacters([...DEFAULT_CHARACTERS, ...updatedCustoms]);
    if (selectedChar?.id === formData.id) {
      setSelectedChar(updatedCustoms.find((c) => c.id === formData.id));
    }
  };

  const closeCharacterModal = () => {
    setShowCreateModal(false);
    setEditingChar(null);
  };

  const handleEditCharacter = (char) => {
    setEditingChar(char);
    setShowCreateModal(true);
  };

  // Download custom characters, chat histories, profile and model choice as a JSON backup (API key excluded)
  const handleExportData = () => {
    const customChars = JSON.parse(store.getItem('user_custom_chars') || '[]');
    const chatHistories = {};
    for (const char of customChars) {
      const saved = store.getItem(`chat_history_${char.id}`);
      if (saved) chatHistories[char.id] = JSON.parse(saved);
    }
    for (const char of DEFAULT_CHARACTERS) {
      const saved = store.getItem(`chat_history_${char.id}`);
      if (saved) chatHistories[char.id] = JSON.parse(saved);
    }

    const backup = {
      app: 'my-ai-roleplay',
      version: 1,
      exportedAt: new Date().toISOString(),
      customCharacters: customChars,
      chatHistories,
      userProfile,
      userRoles,
      chatActivity,
      model,
      responseSettings,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `khui-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Restore a backup file: custom characters are merged by id, histories and profile are overwritten
  const handleImportData = async (file) => {
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.app !== 'my-ai-roleplay' || !Array.isArray(backup.customCharacters)) {
        throw new Error('ไม่ใช่ไฟล์ Backup ของแอปนี้');
      }
      const validChars = backup.customCharacters
        .filter((c) => c && typeof c.id === 'string' && c.id.startsWith('custom_') && c.name && c.description && c.greeting)
        .map((c) => ({ ...c, realism: normalizeRealism(c.realism) }));
      const ok = await askConfirm({
        title: 'นำเข้า Backup?',
        text: `ตัวละคร ${validChars.length} ตัวจะถูกเพิ่มเข้ามา ส่วนแชทและโปรไฟล์ที่ซ้ำกันจะถูกแทนที่ด้วยของในไฟล์`,
        confirmLabel: 'นำเข้า',
      });
      if (!ok) return;
      stopStreaming({ discard: true });

      const existing = JSON.parse(store.getItem('user_custom_chars') || '[]');
      const merged = [...existing.filter((c) => !validChars.some((v) => v.id === c.id)), ...validChars];
      store.setItem('user_custom_chars', JSON.stringify(merged));
      setCharacters([...DEFAULT_CHARACTERS, ...merged]);

      const knownIds = new Set([...DEFAULT_CHARACTERS, ...merged].map((c) => c.id));
      for (const [id, history] of Object.entries(backup.chatHistories || {})) {
        if (knownIds.has(id) && Array.isArray(history)) {
          store.setItem(`chat_history_${id}`, JSON.stringify(history));
        }
      }

      const activity = readChatActivity(store);
      for (const [id, at] of Object.entries(backup.chatActivity || {})) {
        if (knownIds.has(id) && Number.isFinite(at) && store.getItem(`chat_history_${id}`)) activity[id] = at;
      }
      store.setItem('user_chat_activity', JSON.stringify(activity));
      setChatActivity(activity);

      if (backup.userProfile) handleSaveUserProfile(backup.userProfile);
      for (const [id, role] of Object.entries(backup.userRoles || {})) {
        if (knownIds.has(id)) handleSaveUserRole(id, normalizeUserRole(role));
      }
      if (AVAILABLE_MODELS.some((m) => m.id === backup.model)) handleSaveModel(backup.model);
      if (backup.responseSettings) handleSaveResponseSettings(backup.responseSettings);

      activeCharIdRef.current = null;
      setSelectedChar(null);
      setMessages([]);
      setToast({ kind: 'success', title: 'นำเข้าข้อมูลสำเร็จ' });
    } catch (err) {
      setToast({ kind: 'error', title: 'นำเข้าไม่สำเร็จ', text: err.message });
    }
  };

  // Delete a custom character
  const handleDeleteCharacter = async (charId) => {
    const char = characters.find((c) => c.id === charId);
    const ok = await askConfirm({
      title: `ลบ ${char?.name || 'ตัวละครนี้'}?`,
      text: 'ตัวละคร แชท และบทบาทของคุณกับตัวละครนี้จะหายไปทั้งหมด กู้คืนไม่ได้',
      confirmLabel: 'ลบตัวละคร',
      danger: true,
      avatar: char?.avatar,
    });
    if (!ok) return;
    if (selectedChar?.id === charId) stopStreaming({ discard: true });

    const existing = JSON.parse(store.getItem('user_custom_chars') || '[]');
    const filtered = existing.filter((c) => c.id !== charId);
    store.setItem('user_custom_chars', JSON.stringify(filtered));

    setCharacters([...DEFAULT_CHARACTERS, ...filtered]);
    dropChat(charId);
    handleSaveUserRole(charId, normalizeUserRole(null));

    if (selectedChar?.id === charId) {
      activeCharIdRef.current = null;
      setSelectedChar(null);
      setMessages([]);
    }
  };

  // Clear chat history for the currently active character
  const handleClearHistory = async () => {
    if (!selectedChar) return;
    const char = selectedChar;
    const ok = await askConfirm({
      title: 'เริ่มคุยใหม่ตั้งแต่ต้น?',
      text: `ข้อความทั้งหมดกับ ${char.name} จะถูกล้าง แล้วเริ่มจากคำทักทายแรกอีกครั้ง`,
      confirmLabel: 'ล้างแชท',
      danger: true,
      avatar: char.avatar,
    });
    if (!ok || activeCharIdRef.current !== char.id) return;
    stopStreaming({ discard: true });
    dropChat(char.id);
    setMessages([{ role: 'model', text: char.greeting }]);
  };

  // Remove a chat from the sidebar's chat list (and its history)
  const handleClearChat = async (charId) => {
    const char = characters.find((c) => c.id === charId);
    const ok = await askConfirm({
      title: `ลบแชทกับ ${char?.name || 'ตัวละครนี้'}?`,
      text: 'ประวัติการคุยทั้งหมดจะหายไป ตัวละครยังอยู่และเริ่มคุยใหม่ได้',
      confirmLabel: 'ลบแชท',
      danger: true,
      avatar: char?.avatar,
    });
    if (!ok) return;
    if (selectedChar?.id === charId) {
      stopStreaming({ discard: true });
      setMessages([{ role: 'model', text: char?.greeting || '' }]);
    }
    dropChat(charId);
  };

  return (
    <div className="flex h-dvh bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Left panel: app actions + chats already started */}
      <Sidebar
        recentChats={recentChats}
        selectedChar={selectedChar}
        onSelectChar={handleSelectChar}
        onClearChat={handleClearChat}
        onGoHome={handleBack}
        onExportData={handleExportData}
        onImportData={handleImportData}
        account={account}
        onOpenSettings={() => setShowSettings(true)}
        onOpenCreateModal={() => {
          setShowHistory(false);
          setShowCreateModal(true);
        }}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      {/* Center: the open chat, or the character grid when no chat is open */}
      {selectedChar ? (
        <ChatWindow
          selectedChar={selectedChar}
          onBack={handleBack}
          messages={messages}
          loading={loading}
          input={input}
          setInput={setInput}
          onSendMessage={handleSendMessage}
          onClearHistory={handleClearHistory}
          onStopReply={handleStopReply}
          onRegenerate={handleRegenerate}
          onRetry={handleRetry}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          hasUserRole={Boolean(userRoles[selectedChar.id])}
          onOpenUserRole={() => setShowUserRole(true)}
        />
      ) : (
        <CharacterBrowser
          characters={characters}
          onSelectChar={handleSelectChar}
          onDeleteChar={handleDeleteCharacter}
          onEditChar={handleEditCharacter}
          onOpenCreateModal={() => setShowCreateModal(true)}
          onOpenHistory={() => setShowHistory(true)}
        />
      )}

      {/* Settings modal with User Persona and API Key configuration */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        model={model}
        onSaveModel={handleSaveModel}
        responseSettings={responseSettings}
        onSaveResponseSettings={handleSaveResponseSettings}
        userProfile={userProfile}
        onSaveUserProfile={handleSaveUserProfile}
      />

      <Toast toast={toast} onClose={closeToast} />
      {confirmDialog}

      {/* Per-character user role modal */}
      <UserRoleModal
        isOpen={showUserRole}
        onClose={() => setShowUserRole(false)}
        character={selectedChar}
        role={selectedChar ? userRoles[selectedChar.id] : null}
        onSave={handleSaveUserRole}
      />

      {/* Create character modal */}
      <CreateCharacterModal
        isOpen={showCreateModal}
        onClose={closeCharacterModal}
        onCreateCharacter={handleCreateCharacter}
        editingCharacter={editingChar}
        onUpdateCharacter={handleUpdateCharacter}
      />
    </div>
  );
}
export default function Home() {
  return <AuthGate>{(session) => <RoleplayApp {...session} />}</AuthGate>;
}
