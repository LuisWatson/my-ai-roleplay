'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import CharacterBrowser from '../components/CharacterBrowser';
import SettingsModal from '../components/SettingsModal';
import CreateCharacterModal from '../components/CreateCharacterModal';
import UserRoleModal from '../components/UserRoleModal';
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
function readChatActivity() {
  let activity = {};
  try {
    activity = JSON.parse(localStorage.getItem('user_chat_activity')) || {};
  } catch (err) {
    console.error('Failed to parse chat activity from localStorage:', err);
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('chat_history_')) {
      const id = key.slice('chat_history_'.length);
      if (!(id in activity)) activity[id] = 0;
    }
  }
  return activity;
}

// One-line preview of a chat's last message, with *(action)* narration removed
function lastMessagePreview(charId) {
  try {
    const history = JSON.parse(localStorage.getItem(`chat_history_${charId}`) || '[]');
    const last = history[history.length - 1];
    if (!last?.text) return '';
    const text = last.text.replace(/\*\([^)]*\)\*/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    return last.role === 'user' ? `คุณ: ${text}` : text;
  } catch {
    return '';
  }
}

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

export default function Home() {
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
  const [showUserRole, setShowUserRole] = useState(false);
  const [chatActivity, setChatActivity] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef(null);
  const activeCharIdRef = useRef(null); // which character's chat is currently on screen

  // Load saved API key, custom characters, and user persona profile on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('user_gemini_api_key');
    if (savedKey) setApiKey(savedKey);

    const savedModel = localStorage.getItem('user_gemini_model');
    if (AVAILABLE_MODELS.some((m) => m.id === savedModel)) setModel(savedModel);

    const savedChars = localStorage.getItem('user_custom_chars');
    if (savedChars) {
      try {
        const parsed = JSON.parse(savedChars);
        setCharacters([...DEFAULT_CHARACTERS, ...parsed]);
      } catch (err) {
        console.error('Failed to parse custom characters from localStorage:', err);
      }
    }

    try {
      const savedSettings = JSON.parse(localStorage.getItem('user_response_settings'));
      if (savedSettings) setResponseSettings(normalizeResponseSettings(savedSettings));
    } catch (err) {
      console.error('Failed to parse response settings from localStorage:', err);
    }

    try {
      const savedRoles = JSON.parse(localStorage.getItem('user_character_roles'));
      if (savedRoles && typeof savedRoles === 'object') {
        setUserRoles(
          Object.fromEntries(Object.entries(savedRoles).map(([id, role]) => [id, normalizeUserRole(role)]))
        );
      }
    } catch (err) {
      console.error('Failed to parse character roles from localStorage:', err);
    }

    setChatActivity(readChatActivity());

    const savedProfile = localStorage.getItem('user_roleplay_profile');
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
      } catch (err) {
        console.error('Failed to parse user profile from localStorage:', err);
      }
    }
  }, []);

  // Save updated API key
  const handleSaveApiKey = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem('user_gemini_api_key', newKey);
  };

  // Save selected Gemini model
  const handleSaveModel = (newModel) => {
    setModel(newModel);
    localStorage.setItem('user_gemini_model', newModel);
  };

  const handleSaveResponseSettings = (settings) => {
    const normalized = normalizeResponseSettings(settings);
    setResponseSettings(normalized);
    localStorage.setItem('user_response_settings', JSON.stringify(normalized));
  };

  // Save (or clear, when every field is empty) the user's role for one character
  const handleSaveUserRole = (charId, role) => {
    setUserRoles((prev) => {
      const next = { ...prev };
      if (USER_ROLE_FIELDS.some((f) => role[f]?.trim())) next[charId] = role;
      else delete next[charId];
      localStorage.setItem('user_character_roles', JSON.stringify(next));
      return next;
    });
  };

  // Save updated user persona profile
  const handleSaveUserProfile = (profile) => {
    setUserProfile(profile);
    localStorage.setItem('user_roleplay_profile', JSON.stringify(profile));
  };

  const writeChatActivity = (update) => {
    setChatActivity((prev) => {
      const next = update({ ...prev });
      localStorage.setItem('user_chat_activity', JSON.stringify(next));
      return next;
    });
  };

  const saveHistory = (charId, history) => {
    localStorage.setItem(`chat_history_${charId}`, JSON.stringify(history));
    writeChatActivity((next) => ({ ...next, [charId]: Date.now() }));
  };

  // Forget a chat entirely: its history and its place in the sidebar's chat list
  const dropChat = (charId) => {
    localStorage.removeItem(`chat_history_${charId}`);
    writeChatActivity((next) => {
      delete next[charId];
      return next;
    });
  };

  const recentChats = useMemo(
    () =>
      characters
        .filter((c) => c.id in chatActivity)
        .map((c) => ({ character: c, at: chatActivity[c.id], preview: lastMessagePreview(c.id) }))
        .sort((a, b) => b.at - a.at),
    [characters, chatActivity]
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

  // Switch character and load their respective conversation history
  const handleSelectChar = (char) => {
    stopStreaming();
    setShowHistory(false);
    activeCharIdRef.current = char.id;
    setSelectedChar(char);
    const savedHistory = localStorage.getItem(`chat_history_${char.id}`);
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

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      const usedModel = res.headers.get('X-Model-Used');
      const failedModels = (res.headers.get('X-Models-Failed') || '').split(',').filter(Boolean);
      if (failedModels.length > 0 && activeCharIdRef.current === charId) {
        setNotice({
          kind: 'info',
          text: `ใช้โมเดลสำรอง ${usedModel} เพราะ ${failedModels.join(', ')} ใช้ไม่ได้ (โควต้าหมดหรือไม่ตอบสนอง)`,
        });
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
      if (controller.stalled && activeCharIdRef.current === charId) {
        setNotice({
          kind: 'warn',
          text: accumulatedText
            ? 'โมเดลหยุดตอบกลางทาง เก็บข้อความที่ได้ไว้แล้ว กด "สร้างคำตอบใหม่" เพื่อลองอีกครั้ง'
            : 'โมเดลไม่ตอบสนอง กด "ลองใหม่" ใต้ข้อความของคุณเพื่อส่งอีกครั้ง',
        });
      } else if (failed) {
        alert(`Error: ${err.message}`);
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

    const existing = JSON.parse(localStorage.getItem('user_custom_chars') || '[]');
    const updatedCustoms = [...existing, created];
    localStorage.setItem('user_custom_chars', JSON.stringify(updatedCustoms));

    setCharacters([...DEFAULT_CHARACTERS, ...updatedCustoms]);
    activeCharIdRef.current = created.id;
    setSelectedChar(created);
    setMessages([{ role: 'model', text: created.greeting }]);
  };

  // Update an existing custom persona in place, keeping its id and chat history
  const handleUpdateCharacter = (formData) => {
    const sanitized = { ...formData, realism: normalizeRealism(formData.realism) };
    const existing = JSON.parse(localStorage.getItem('user_custom_chars') || '[]');
    const updatedCustoms = existing.map((c) => (c.id === sanitized.id ? { ...c, ...sanitized } : c));
    localStorage.setItem('user_custom_chars', JSON.stringify(updatedCustoms));

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
    const customChars = JSON.parse(localStorage.getItem('user_custom_chars') || '[]');
    const chatHistories = {};
    for (const char of customChars) {
      const saved = localStorage.getItem(`chat_history_${char.id}`);
      if (saved) chatHistories[char.id] = JSON.parse(saved);
    }
    for (const char of DEFAULT_CHARACTERS) {
      const saved = localStorage.getItem(`chat_history_${char.id}`);
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
      if (!confirm(`นำเข้าตัวละคร ${validChars.length} ตัว และเขียนทับประวัติแชท/โปรไฟล์ที่ซ้ำกัน ต้องการดำเนินการต่อหรือไม่?`)) return;
      stopStreaming({ discard: true });

      const existing = JSON.parse(localStorage.getItem('user_custom_chars') || '[]');
      const merged = [...existing.filter((c) => !validChars.some((v) => v.id === c.id)), ...validChars];
      localStorage.setItem('user_custom_chars', JSON.stringify(merged));
      setCharacters([...DEFAULT_CHARACTERS, ...merged]);

      const knownIds = new Set([...DEFAULT_CHARACTERS, ...merged].map((c) => c.id));
      for (const [id, history] of Object.entries(backup.chatHistories || {})) {
        if (knownIds.has(id) && Array.isArray(history)) {
          localStorage.setItem(`chat_history_${id}`, JSON.stringify(history));
        }
      }

      const activity = readChatActivity();
      for (const [id, at] of Object.entries(backup.chatActivity || {})) {
        if (knownIds.has(id) && Number.isFinite(at) && localStorage.getItem(`chat_history_${id}`)) activity[id] = at;
      }
      localStorage.setItem('user_chat_activity', JSON.stringify(activity));
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
      alert('นำเข้าข้อมูลสำเร็จ');
    } catch (err) {
      alert(`นำเข้าไม่สำเร็จ: ${err.message}`);
    }
  };

  // Delete a custom character
  const handleDeleteCharacter = (charId) => {
    if (!confirm('ต้องการลบตัวละครนี้ใช่หรือไม่?')) return;
    if (selectedChar?.id === charId) stopStreaming({ discard: true });

    const existing = JSON.parse(localStorage.getItem('user_custom_chars') || '[]');
    const filtered = existing.filter((c) => c.id !== charId);
    localStorage.setItem('user_custom_chars', JSON.stringify(filtered));

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
  const handleClearHistory = () => {
    if (!selectedChar) return;
    if (confirm('ต้องการล้างประวัติการคุยกับตัวละครนี้ใช่หรือไม่?')) {
      stopStreaming({ discard: true });
      dropChat(selectedChar.id);
      setMessages([{ role: 'model', text: selectedChar.greeting }]);
    }
  };

  // Remove a chat from the sidebar's chat list (and its history)
  const handleClearChat = (charId) => {
    if (!confirm('ต้องการลบแชทนี้ใช่หรือไม่? ประวัติการคุยทั้งหมดจะหายไป')) return;
    const char = characters.find((c) => c.id === charId);
    if (selectedChar?.id === charId) {
      stopStreaming({ discard: true });
      setMessages([{ role: 'model', text: char?.greeting || '' }]);
    }
    dropChat(charId);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Left panel: app actions + chats already started */}
      <Sidebar
        recentChats={recentChats}
        selectedChar={selectedChar}
        onSelectChar={handleSelectChar}
        onClearChat={handleClearChat}
        onGoHome={handleBack}
        onExportData={handleExportData}
        onImportData={handleImportData}
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