'use client';

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import SettingsModal from '../components/SettingsModal';
import CreateCharacterModal from '../components/CreateCharacterModal';
import UserRoleModal from '../components/UserRoleModal';
import { normalizeUserRole, mergeUserProfile, USER_ROLE_FIELDS } from '../lib/userRole';
import { DEFAULT_CHARACTERS } from '../constants/characters';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../constants/models';
import {
  DEFAULT_RESPONSE_SETTINGS,
  HISTORY_CHAR_BUDGET,
  normalizeResponseSettings,
} from '../constants/chatSettings';

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
  const [showUserRole, setShowUserRole] = useState(false);
  const abortRef = useRef(null);

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

  const saveHistory = (charId, history) => {
    localStorage.setItem(`chat_history_${charId}`, JSON.stringify(history));
  };

  // Cancel the in-flight reply. `discard` skips saving the partial reply (history cleared or character deleted).
  const stopStreaming = ({ discard = false } = {}) => {
    if (!abortRef.current) return;
    abortRef.current.discard = discard;
    abortRef.current.abort();
    abortRef.current = null;
    setLoading(false);
  };

  // Switch character and load their respective conversation history
  const handleSelectChar = (char) => {
    stopStreaming();
    setSelectedChar(char);
    const savedHistory = localStorage.getItem(`chat_history_${char.id}`);
    if (savedHistory) {
      try {
        setMessages(JSON.parse(savedHistory));
        return;
      } catch (err) {
        console.error('Failed to parse chat history:', err);
      }
    }
    setMessages([{ role: 'model', text: char.greeting }]);
  };

  const handleBack = () => {
    stopStreaming();
    setSelectedChar(null);
  };

  // Send message and stream response from Gemini API
  const handleSendMessage = async () => {
    if (!input.trim() || loading || !selectedChar) return;

    const userMessage = input.trim();
    setInput('');

    const charId = selectedChar.id;
    const updatedMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(updatedMessages);
    saveHistory(charId, updatedMessages);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulatedText = '';

    try {
      const historyPayload = takeRecentMessages(updatedMessages, HISTORY_CHAR_BUDGET);

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
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      // Add empty placeholder for the incoming stream; `loading` stays true so the input stays locked
      setMessages((prev) => [...prev, { role: 'model', text: '' }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        setMessages((prev) => {
          const nextState = [...prev];
          const lastIndex = nextState.length - 1;
          if (lastIndex >= 0 && nextState[lastIndex].role === 'model') {
            nextState[lastIndex] = { ...nextState[lastIndex], text: accumulatedText };
          }
          return nextState;
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        // Drop the empty placeholder bubble; keep any partial reply already received
        if (!accumulatedText) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            return last?.role === 'model' && !last.text ? prev.slice(0, -1) : prev;
          });
        }
        alert(`Error: ${err.message}`);
      }
    } finally {
      if (accumulatedText && !controller.discard) {
        saveHistory(charId, [...updatedMessages, { role: 'model', text: accumulatedText }]);
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  // Create and persist a new custom persona
  const handleCreateCharacter = (formData) => {
    const created = {
      ...formData,
      id: `custom_${Date.now()}`,
    };

    const existing = JSON.parse(localStorage.getItem('user_custom_chars') || '[]');
    const updatedCustoms = [...existing, created];
    localStorage.setItem('user_custom_chars', JSON.stringify(updatedCustoms));

    setCharacters([...DEFAULT_CHARACTERS, ...updatedCustoms]);
    setSelectedChar(created);
    setMessages([{ role: 'model', text: created.greeting }]);
  };

  // Update an existing custom persona in place, keeping its id and chat history
  const handleUpdateCharacter = (formData) => {
    const existing = JSON.parse(localStorage.getItem('user_custom_chars') || '[]');
    const updatedCustoms = existing.map((c) => (c.id === formData.id ? { ...c, ...formData } : c));
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
      const validChars = backup.customCharacters.filter(
        (c) => c && typeof c.id === 'string' && c.id.startsWith('custom_') && c.name && c.description && c.greeting
      );
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

      if (backup.userProfile) handleSaveUserProfile(backup.userProfile);
      for (const [id, role] of Object.entries(backup.userRoles || {})) {
        if (knownIds.has(id)) handleSaveUserRole(id, normalizeUserRole(role));
      }
      if (AVAILABLE_MODELS.some((m) => m.id === backup.model)) handleSaveModel(backup.model);
      if (backup.responseSettings) handleSaveResponseSettings(backup.responseSettings);

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
    localStorage.removeItem(`chat_history_${charId}`);
    handleSaveUserRole(charId, normalizeUserRole(null));

    if (selectedChar?.id === charId) {
      setSelectedChar(null);
      setMessages([]);
    }
  };

  // Clear chat history for the currently active character
  const handleClearHistory = () => {
    if (!selectedChar) return;
    if (confirm('ต้องการล้างประวัติการคุยกับตัวละครนี้ใช่หรือไม่?')) {
      stopStreaming({ discard: true });
      localStorage.removeItem(`chat_history_${selectedChar.id}`);
      setMessages([{ role: 'model', text: selectedChar.greeting }]);
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar for character selection */}
      <Sidebar
        characters={characters}
        selectedChar={selectedChar}
        onSelectChar={handleSelectChar}
        onDeleteChar={handleDeleteCharacter}
        onEditChar={handleEditCharacter}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onOpenSettings={() => setShowSettings(true)}
        onOpenCreateModal={() => setShowCreateModal(true)}
      />

      {/* Main chat window view */}
      <ChatWindow
        selectedChar={selectedChar}
        onBack={handleBack}
        messages={messages}
        loading={loading}
        input={input}
        setInput={setInput}
        onSendMessage={handleSendMessage}
        onClearHistory={handleClearHistory}
        hasUserRole={Boolean(selectedChar && userRoles[selectedChar.id])}
        onOpenUserRole={() => setShowUserRole(true)}
      />

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