'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import SettingsModal from '../components/SettingsModal';
import CreateCharacterModal from '../components/CreateCharacterModal';
import { DEFAULT_CHARACTERS } from '../constants/characters';

export default function Home() {
  const [characters, setCharacters] = useState(DEFAULT_CHARACTERS);
  const [selectedChar, setSelectedChar] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [userProfile, setUserProfile] = useState({ name: '', callMe: '', description: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load saved API key, custom characters, and user persona profile on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('user_gemini_api_key');
    if (savedKey) setApiKey(savedKey);

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
        userProfile={userProfile}
        onSaveUserProfile={handleSaveUserProfile}
      />

      {/* Create character modal */}
      <CreateCharacterModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateCharacter={handleCreateCharacter}
      />
    </div>
  );
}