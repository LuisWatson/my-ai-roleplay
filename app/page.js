'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import SettingsModal from '../components/SettingsModal';
import CreateCharacterModal from '../components/CreateCharacterModal';
import { DEFAULT_CHARACTERS } from '../constants/characters';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../constants/models';

export default function Home() {
  const [characters, setCharacters] = useState(DEFAULT_CHARACTERS);
  const [selectedChar, setSelectedChar] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [userProfile, setUserProfile] = useState({ name: '', callMe: '', description: '' });
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChar, setEditingChar] = useState(null);

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

  // Save updated user persona profile
  const handleSaveUserProfile = (profile) => {
    setUserProfile(profile);
    localStorage.setItem('user_roleplay_profile', JSON.stringify(profile));
  };

  // Switch character and load their respective conversation history
  const handleSelectChar = (char) => {
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

  // Send message and stream response from Gemini API
  const handleSendMessage = async () => {
    if (!input.trim() || loading || !selectedChar) return;

    const userMessage = input.trim();
    setInput('');

    const updatedMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Send up to the last 10 messages for conversational context
      const historyPayload = updatedMessages.slice(-10).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: historyPayload.slice(0, -1),
          persona: selectedChar,
          apiKey: apiKey,
          model: model,
          userProfile: userProfile,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      // Add empty placeholder for the incoming stream
      setMessages((prev) => [...prev, { role: 'model', text: '' }]);
      setLoading(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';

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

      // Persist the complete dialogue in localStorage once stream finishes
      const finalHistory = [...updatedMessages, { role: 'model', text: accumulatedText }];
      localStorage.setItem(`chat_history_${selectedChar.id}`, JSON.stringify(finalHistory));
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
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
      model,
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
      if (AVAILABLE_MODELS.some((m) => m.id === backup.model)) handleSaveModel(backup.model);

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

    const existing = JSON.parse(localStorage.getItem('user_custom_chars') || '[]');
    const filtered = existing.filter((c) => c.id !== charId);
    localStorage.setItem('user_custom_chars', JSON.stringify(filtered));

    setCharacters([...DEFAULT_CHARACTERS, ...filtered]);
    localStorage.removeItem(`chat_history_${charId}`);

    if (selectedChar?.id === charId) {
      setSelectedChar(null);
      setMessages([]);
    }
  };

  // Clear chat history for the currently active character
  const handleClearHistory = () => {
    if (!selectedChar) return;
    if (confirm('ต้องการล้างประวัติการคุยกับตัวละครนี้ใช่หรือไม่?')) {
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
        onBack={() => setSelectedChar(null)}
        messages={messages}
        loading={loading}
        input={input}
        setInput={setInput}
        onSendMessage={handleSendMessage}
        onClearHistory={handleClearHistory}
      />

      {/* Settings modal with User Persona and API Key configuration */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        model={model}
        onSaveModel={handleSaveModel}
        userProfile={userProfile}
        onSaveUserProfile={handleSaveUserProfile}
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