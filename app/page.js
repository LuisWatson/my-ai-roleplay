'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import CharacterBrowser from '../components/CharacterBrowser';
import SettingsModal from '../components/SettingsModal';
import CreateCharacterModal from '../components/CreateCharacterModal';
import UserRoleModal from '../components/UserRoleModal';
import MemoryModal from '../components/MemoryModal';
import CharacterProfile from '../components/CharacterProfile';
import AuthGate from '../components/AuthGate';
import Toast from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { normalizeUserRole, mergeUserProfile, USER_ROLE_FIELDS } from '../lib/userRole';
import { normalizeRealism } from '../constants/scenario';
import { stripTrailingPartialTag, finalizeReply, latestScene, splitCut } from '../lib/scene';
import { DEFAULT_CHARACTERS } from '../constants/characters';
import { memoryKey, pinsKey, readMemory, readPins, cleanPins, chatWindow, nextMemoryBatch, fingerprint } from '../lib/memory';
import {
  journalKey,
  readJournal,
  addJournalEntry,
  removeJournalEntry,
  renameJournalEntry,
  journalForPrompt,
  offeredMomentTitles,
  isRepeatedMoment,
} from '../lib/journal';
import { latestRelation, settleRelation } from '../lib/relation';
import { openingMessage, personaForChat } from '../lib/story';
import { cleanChoices } from '../lib/choices';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../constants/models';
import {
  DEFAULT_RESPONSE_SETTINGS,
  FIRST_RESPONSE_CLIENT_TIMEOUT_MS,
  STALL_TIMEOUT_MS,
  normalizeResponseSettings,
  chatStyleKey,
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
  blocked: {
    kind: 'warn',
    title: 'Google ไม่ยอมตอบเนื้อหาช่วงนี้',
    text: 'ระบบความปลอดภัยของ Google บล็อกคำตอบนี้ ลองแก้ข้อความล่าสุด (✏️) หรือกำกับให้เรื่องไปทางอื่น แล้วส่งใหม่ — กดส่งซ้ำแบบเดิมจะโดนบล็อกอีก',
    retry: false,
  },
};

// The character as sent to the server: the model never sees the pictures, and an uploaded photo is a
// large data URL, so leave them out of every request
function withoutImages({ avatar, background, ...persona }) {
  return persona;
}

// What one swipe version of a reply holds (missing parts stay undefined, so switching clears them)
function swipeVersion({ text, scene, moment, relation, choices, choicesSource, thought, style }) {
  return { text, scene, moment, relation, choices, choicesSource, thought, style };
}

// A reply without its other swipe versions (once the story moves on, only the chosen one is kept)
function withoutSwipes({ alts, altIndex, ...message }) {
  return message;
}

const SIDEBAR_COLLAPSED_KEY = 'botbaat_sidebar_collapsed';

// A character's saved conversation, or just their greeting when there is none yet
function savedHistoryOrGreeting(store, char) {
  try {
    const parsed = JSON.parse(store.getItem(`chat_history_${char.id}`) || '[]');
    // A chat that never got past the old greeting starts over with the story setup
    const untouched = parsed.length === 1 && parsed[0]?.role === 'model' && !parsed[0].storyStart;
    if (Array.isArray(parsed) && parsed.length > 0 && !untouched) return parsed;
  } catch (err) {
    console.error('Failed to parse chat history:', err);
  }
  return [openingMessage(char)];
}


function RoleplayApp({ store, account, getAccessToken }) {
  const [characters, setCharacters] = useState(DEFAULT_CHARACTERS);
  const [selectedChar, setSelectedChar] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // True from sending until the first words arrive (shows the "thinking" bubble, also for continue)
  const [waiting, setWaiting] = useState(false);
  // Id of the character whose suggestions are being fetched (+ menu or automatic), else null
  const [suggesting, setSuggesting] = useState(null);
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
  const [showUserRole, setShowUserRole] = useState(false); // false | true (opened by the user) | 'auto' (first visit)
  const [chatActivity, setChatActivity] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  // Desktop only: the left panel can be hidden. Kept per device in localStorage, not in the synced store.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {}
  }, []);
  const toggleSidebar = useCallback((collapsed) => {
    setSidebarCollapsed(collapsed);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {}
  }, []);
  const [direction, setDirection] = useState(''); // story direction for the next reply only
  const [chatStyle, setChatStyle] = useState('novel'); // 'novel' | 'dm' for the open chat
  const [profileView, setProfileView] = useState(null); // { character, status, hasChat } while a profile is open
  const [roleFor, setRoleFor] = useState(null); // character the role form edits when opened from a profile
  const [memoryView, setMemoryView] = useState(null); // { summary, pins } while the memory panel is open
  const abortRef = useRef(null);
  const activeCharIdRef = useRef(null); // which character's chat is currently on screen

  // Put everything saved in the store into state; returns the full character list it loaded.
  // Runs on mount and again whenever another device has changed the data (see the refresh effect below).
  const loadSaved = () => {
    const savedKey = store.getItem('user_gemini_api_key');
    if (savedKey) setApiKey(savedKey);

    const savedModel = store.getItem('user_gemini_model');
    if (AVAILABLE_MODELS.some((m) => m.id === savedModel)) setModel(savedModel);

    let allChars = DEFAULT_CHARACTERS;
    try {
      const parsed = JSON.parse(store.getItem('user_custom_chars') || '[]');
      if (Array.isArray(parsed)) allChars = [...DEFAULT_CHARACTERS, ...parsed];
    } catch (err) {
      console.error('Failed to parse custom characters from storage:', err);
    }
    setCharacters(allChars);

    try {
      const savedSettings = JSON.parse(store.getItem('user_response_settings'));
      if (savedSettings) setResponseSettings(normalizeResponseSettings(savedSettings));
    } catch (err) {
      console.error('Failed to parse response settings from storage:', err);
    }

    try {
      const savedRoles = JSON.parse(store.getItem('user_character_roles'));
      setUserRoles(
        savedRoles && typeof savedRoles === 'object'
          ? Object.fromEntries(Object.entries(savedRoles).map(([id, role]) => [id, normalizeUserRole(role)]))
          : {}
      );
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
    return allChars;
  };

  useEffect(() => {
    loadSaved();
  }, []);

  // Coming back to the tab: pick up what another device saved meanwhile, so this one doesn't write over it.
  // Skipped while a reply is streaming; the next focus catches up.
  useEffect(() => {
    if (!store.refresh) return; // localStorage-only mode has nothing to fetch
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || abortRef.current) return;
      let changed = false;
      try {
        changed = await store.refresh();
      } catch (err) {
        console.error('Refreshing saved data failed:', err);
      }
      if (!changed || abortRef.current) return;

      const allChars = loadSaved();
      const openId = activeCharIdRef.current;
      if (!openId) return;
      const openChar = allChars.find((c) => c.id === openId);
      if (!openChar) {
        // Deleted on the other device
        activeCharIdRef.current = null;
        setSelectedChar(null);
        setMessages([]);
        return;
      }
      setSelectedChar(openChar);
      setMessages(savedHistoryOrGreeting(store, openChar));
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [store]);

  // Closing the tab before the last save reached the server would lose it; let the browser ask first
  useEffect(() => {
    if (!store.hasPendingWrites) return;
    const onBeforeUnload = (e) => {
      if (!store.hasPendingWrites()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [store]);

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
    store.removeItem(memoryKey(charId));
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
    setWaiting(false);
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
    setDirection('');
    setChatStyle(store.getItem(chatStyleKey(char.id)) === 'dm' ? 'dm' : 'novel');
    if (!userRoles[char.id] && markRolePrompted(char.id)) setShowUserRole('auto');
    setMessages(savedHistoryOrGreeting(store, char));
  };

  // Character grid → profile sheet first; it shows how things stand if there is a chat already
  const openProfile = (char) => {
    let history = [];
    try {
      history = JSON.parse(store.getItem(`chat_history_${char.id}`) || '[]');
    } catch {
      history = [];
    }
    setProfileView({
      character: char,
      hasChat: Array.isArray(history) && history.length > 0,
      status: { relation: latestRelation(history), journalCount: readJournal(store, char.id).length },
    });
  };

  const closeProfile = useCallback(() => setProfileView(null), []);

  const startChatFromProfile = () => {
    const char = profileView?.character;
    setProfileView(null);
    if (char) handleSelectChar(char);
  };

  const handleBack = () => {
    stopStreaming();
    setShowHistory(false);
    setDirection('');
    activeCharIdRef.current = null;
    setSelectedChar(null);
  };

  // Characters whose memory is being updated right now (one summary request per chat at a time)
  const memoryJobsRef = useRef(new Set());

  // After a reply: once enough older chat has piled up beyond what is sent with each message, have it
  // summarized into the chat's long-term memory. Runs in the background; a failure is retried after the
  // next reply.
  const updateMemory = async (persona, chatMessages) => {
    const charId = persona.id;
    if (memoryJobsRef.current.has(charId)) return;
    const memory = readMemory(store, charId, chatMessages);
    const batch = nextMemoryBatch(chatMessages, memory);
    if (!batch) return;

    memoryJobsRef.current.add(charId);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          characterName: persona.name,
          userName: mergeUserProfile(userProfile, userRoles[charId]).name,
          previousSummary: memory?.summary || '',
          messages: batch.messages,
          apiKey,
        }),
      });
      if (!res.ok) return;
      const { summary } = await res.json();
      if (!summary) return;

      // Keep it only if the summarized messages are still the ones saved (not edited or cleared meanwhile)
      const hash = fingerprint(chatMessages, batch.to);
      const saved = JSON.parse(store.getItem(`chat_history_${charId}`) || '[]');
      if (fingerprint(saved, batch.to) !== hash) return;
      store.setItem(memoryKey(charId), JSON.stringify({ summary, covered: batch.to, hash }));
    } catch (err) {
      console.warn('Memory update failed:', err);
    } finally {
      memoryJobsRef.current.delete(charId);
    }
  };

  // Stream a reply for `baseMessages`, which must end with the user message being answered.
  // `previous`: the reply being regenerated; the new one is added to its swipes, and it comes back if
  // generating fails. `direction`: out-of-story instruction for this reply only.
  // `continueStory`: no new user message; the last message is the character's own and the reply continues it
  const streamReply = async (
    baseMessages,
    { previous = null, direction: storyDirection = '', continueStory = false } = {}
  ) => {
    if (loading || !selectedChar) return;

    const persona = selectedChar;
    const charId = selectedChar.id;
    const userMessage = baseMessages[baseMessages.length - 1].text;
    setMessages(baseMessages);
    // While regenerating, the saved chat keeps the old reply until a new one arrives
    if (!previous) saveHistory(charId, baseMessages);
    setLoading(true);
    setWaiting(true);
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
      const memory = readMemory(store, charId, baseMessages);
      const historyPayload = chatWindow(baseMessages, memory);
      const accessToken = await getAccessToken();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        signal: controller.signal,
        body: JSON.stringify({
          message: continueStory ? '' : userMessage,
          history: continueStory ? historyPayload : historyPayload.slice(0, -1),
          continueStory: continueStory || undefined,
          persona: personaForChat(withoutImages(selectedChar), baseMessages),
          apiKey: apiKey,
          model: model,
          responseSettings: responseSettings,
          userProfile: mergeUserProfile(userProfile, userRoles[charId]),
          scene: latestScene(baseMessages) || undefined,
          memory: memory?.summary,
          pinned: readPins(store, charId),
          journal: journalForPrompt(readJournal(store, charId)),
          offeredMoments: offeredMomentTitles(baseMessages),
          relation: latestRelation(baseMessages) || undefined,
          chatStyle,
          direction: storyDirection.trim() || undefined,
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
        setWaiting(false);
        setMessages((prev) => [...prev, { role: 'model', text: '', ...(chatStyle === 'dm' && { style: 'dm' }) }]);
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
            nextState[lastIndex] = { ...nextState[lastIndex], text: stripTrailingPartialTag(splitCut(accumulatedText).text) };
          }
          return nextState;
        });
      }
    } catch (err) {
      const failed = !controller.signal.aborted;
      if ((failed || controller.userStopped || controller.stalled) && !accumulatedText && activeCharIdRef.current === charId) {
        // Drop the empty placeholder bubble (or bring back the reply that was being regenerated);
        // keep any partial reply already received
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          const rest = last?.role === 'model' && !last.text ? prev.slice(0, -1) : prev;
          return previous ? [...rest, previous] : rest;
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
      // Google stopped the reply partway and the server could not finish it (it says why after a marker):
      // keep what arrived. Only a cut in the story itself gets a notice; one inside the scene tag at the end
      // loses just the tag, and suggestions are fetched separately.
      const { text: replyText, cut } = splitCut(accumulatedText);
      if (cut) console.warn('Reply was cut:', cut);
      if (cut && replyText && !replyText.includes('[ฉาก:') && !controller.discard && activeCharIdRef.current === charId) {
        setNotice({
          kind: 'warn',
          title: 'คำตอบถูกตัดกลางทาง',
          text: 'เก็บส่วนที่ได้ไว้แล้ว กด "สร้างคำตอบใหม่" ถ้าอยากได้คำตอบเต็ม',
          detail: cut,
        });
      }
      if (replyText && !controller.discard) {
        const {
          cleanText,
          scene,
          moment: momentTitle,
          relation: reportedRelation,
          relationRaw,
          choices: reportedChoices,
          thought,
        } = finalizeReply(replyText);
        const relation = responseSettings.relationship
          ? settleRelation(latestRelation(baseMessages), reportedRelation)
          : undefined;
        // Choices that read as the character, copy the reply, or carry a stray foreign letter are dropped;
        // with none left the reply counts as having none and the Lite fallback below makes them
        const choiceRole = mergeUserProfile(userProfile, userRoles[charId]);
        const choices = responseSettings.suggestions
          ? cleanChoices(reportedChoices, { names: [choiceRole.name, choiceRole.callMe], reply: cleanText })
          : undefined;
        // A moment the model flagged: saved right away ('auto') or offered under the reply ('ask').
        // One already saved or offered in this chat is dropped: models bring old ones back under the new reply.
        const knownMoments = [
          ...readJournal(store, charId).map((e) => e.title),
          ...baseMessages.map((m) => m.moment?.title).filter(Boolean),
        ];
        const repeated = momentTitle && isRepeatedMoment(momentTitle, knownMoments);
        if (repeated) console.info('Dropped a repeated moment:', momentTitle);
        let moment;
        if (momentTitle && !repeated && responseSettings.journal !== 'off') {
          if (responseSettings.journal === 'auto') {
            const entry = addJournalEntry(store, charId, { title: momentTitle, message: { text: cleanText }, scene });
            moment = { title: momentTitle, state: 'saved', entryId: entry.id };
          } else {
            moment = { title: momentTitle, state: 'pending' };
          }
        }
        let reply = {
          role: 'model',
          text: cleanText,
          scene,
          ...(moment && { moment }),
          ...(relation && { relation }),
          ...(relation && relationRaw && { relationRaw }),
          ...(choices && { choices, choicesSource: 'tag' }),
          ...(thought && { thought }),
          ...(chatStyle === 'dm' && { style: 'dm' }),
        };
        if (previous) {
          const alts = previous.alts || [swipeVersion(previous)];
          reply = { ...reply, alts: [...alts, swipeVersion(reply)], altIndex: alts.length };
        }
        const finalMessages = [...baseMessages, reply];
        saveHistory(charId, finalMessages);
        updateMemory(persona, finalMessages);
        // The chat model often leaves the choices out of its tag: ask the Lite models for them instead
        // (also for a reply Google cut short: it usually loses only the tag at the end)
        if (responseSettings.suggestions && !choices && cleanText && !controller.stalled && !controller.userStopped) {
          requestSuggestions(persona, finalMessages, { auto: true });
        }
        if (activeCharIdRef.current === charId) setDirection('');
        // Only touch the currently displayed chat if it's still this one (the user may have switched away)
        if (activeCharIdRef.current === charId) {
          setMessages((prev) => {
            const nextState = [...prev];
            const lastIndex = nextState.length - 1;
            if (lastIndex >= 0 && nextState[lastIndex].role === 'model') {
              nextState[lastIndex] = reply;
            }
            return nextState;
          });
        }
      } else if (previous && !controller.discard) {
        saveHistory(charId, [...baseMessages, previous]);
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
        setWaiting(false);
      }
    }
  };

  // Send message and stream response from Gemini API
  // The story moves on from the last reply: keep only the version on screen. Moments the other versions
  // saved to the journal (e.g. one per regenerate in 'auto' mode) leave the journal with them.
  const settleSwipes = (msgs) => {
    const last = msgs[msgs.length - 1];
    if (!last?.alts) return msgs;
    const keptEntry = last.moment?.entryId;
    for (const alt of last.alts) {
      const entryId = alt.moment?.state === 'saved' ? alt.moment.entryId : null;
      if (entryId && entryId !== keptEntry) removeJournalEntry(store, selectedChar.id, entryId);
    }
    return [...msgs.slice(0, -1), withoutSwipes(last)];
  };

  const handleSendMessage = () => {
    if (!input.trim() || loading || !selectedChar) return;

    const userMessage = input.trim();
    setInput('');
    const settled = settleSwipes(messages);
    streamReply([...settled, { role: 'user', text: userMessage, ...(chatStyle === 'dm' && { style: 'dm' }) }], { direction });
  };

  // "Continue" button (empty input): the character carries the scene on without a new user message
  const handleContinue = () => {
    if (loading || !selectedChar || messages[messages.length - 1]?.role !== 'model') return;
    streamReply(settleSwipes(messages), { direction, continueStory: true });
  };

  // Ask /api/suggest (Lite models) for three suggested replies to the last message of `msgs`, a reply of
  // `persona`. Used by "แนะนำคำตอบ" in the + menu, and automatically when a reply came without choices.
  // The choices are stored on that reply (also in its current swipe) if it is still the last message.
  const requestSuggestions = async (persona, msgs, { auto = false } = {}) => {
    const charId = persona.id;
    const index = msgs.length - 1;
    const target = msgs[index];
    setSuggesting(charId);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          characterName: persona.name,
          characterDescription: persona.description,
          userProfile: (() => {
            const role = mergeUserProfile(userProfile, userRoles[charId]);
            return {
              name: role.name,
              callMe: role.callMe,
              description: role.description || persona.defaultUserRole?.description || '',
            };
          })(),
          messages: msgs.slice(-8).map(({ role, text }) => ({ role, text })),
          chatStyle,
          auto: auto || undefined,
          apiKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.choices?.length) throw new Error(data.error || `HTTP ${res.status}`);
      const role = mergeUserProfile(userProfile, userRoles[charId]);
      const choices = cleanChoices(data.choices, { names: [role.name, role.callMe], reply: target.text });
      if (!choices) throw new Error('ตัวเลือกที่ได้มาใช้ไม่ได้ ลองอีกครั้ง');
      const attach = (list) => {
        const m = list[index];
        if (list.length - 1 !== index || m?.role !== 'model' || m.text !== target.text) return list;
        const withChoices = {
          ...m,
          choices,
          choicesSource: 'suggest',
          ...(!auto && { choicesAsked: true }),
          ...(m.alts && { alts: m.alts.map((a, j) => (j === m.altIndex ? { ...a, choices, choicesSource: 'suggest' } : a)) }),
        };
        return list.map((x, i) => (i === index ? withChoices : x));
      };
      if (activeCharIdRef.current === charId) {
        setMessages((prev) => {
          const next = attach(prev);
          if (next !== prev) saveHistory(charId, next);
          return next;
        });
      } else {
        // The user switched to another chat meanwhile: update the saved one
        const saved = JSON.parse(store.getItem(`chat_history_${charId}`) || '[]');
        const next = attach(saved);
        if (next !== saved) saveHistory(charId, next);
      }
    } catch (err) {
      if (!auto) setToast({ kind: 'error', title: 'ขอคำแนะนำไม่สำเร็จ', text: err.message });
      else console.warn('Auto suggestions failed:', err);
    } finally {
      setSuggesting((current) => (current === charId ? null : current));
    }
  };

  const handleSuggest = () => {
    const last = messages[messages.length - 1];
    if (loading || !selectedChar || suggesting === selectedChar.id || last?.role !== 'model') return;
    requestSuggestions(selectedChar, messages);
  };

  // Stop the reply the user is waiting for; whatever text has arrived is kept
  const handleStopReply = () => {
    if (abortRef.current) abortRef.current.userStopped = true;
    stopStreaming();
  };

  // Resend the last user message when it never got a reply
  const handleRetry = () => {
    if (loading) return;
    if (messages[messages.length - 1]?.role === 'user') streamReply(messages, { direction });
  };

  // Switch the open chat between novel-style roleplay and short messaging-app chat
  const handleToggleChatStyle = () => {
    if (!selectedChar) return;
    const next = chatStyle === 'dm' ? 'novel' : 'dm';
    setChatStyle(next);
    if (next === 'dm') store.setItem(chatStyleKey(selectedChar.id), 'dm');
    else store.removeItem(chatStyleKey(selectedChar.id));
  };

  // Generate another version of the last reply; earlier versions stay as swipes
  const handleRegenerate = () => {
    if (loading) return;
    const last = messages[messages.length - 1];
    if (last?.role !== 'model' || !messages.slice(0, -1).some((m) => m.role === 'user')) return;
    streamReply(messages.slice(0, -1), { previous: last, direction });
  };

  // Show the previous (-1) or next (+1) version of the last reply
  const handleSwipe = (delta) => {
    const last = messages[messages.length - 1];
    if (loading || !last?.alts) return;
    const altIndex = last.altIndex + delta;
    const alt = last.alts[altIndex];
    if (!alt) return;
    persistMessages([...messages.slice(0, -1), { ...withoutSwipes(last), ...swipeVersion(alt), alts: last.alts, altIndex }]);
  };

  // Set a message's moment (and its current swipe version's), e.g. after saving it to the journal
  const setMessageMoment = (index, moment) => {
    persistMessages(
      messages.map((m, i) => {
        if (i !== index) return m;
        const next = { ...m, moment };
        if (m.alts) next.alts = m.alts.map((a, j) => (j === m.altIndex ? { ...a, moment } : a));
        return next;
      })
    );
  };

  // Save message `index` to the journal, titled by the user or by the moment the model flagged
  const handleSaveMoment = (index, title) => {
    const message = messages[index];
    const name = (title ?? message?.moment?.title ?? '').trim();
    if (loading || !message || !selectedChar || !name) return;
    // A user message has no scene of its own: use the reply to it, else the scene at that point
    const scene = message.scene || messages[index + 1]?.scene || latestScene(messages.slice(0, index + 1));
    const entry = addJournalEntry(store, selectedChar.id, { title: name, message, scene });
    setMessageMoment(index, { title: name, state: 'saved', entryId: entry.id });
  };

  const handleDismissMoment = (index) => {
    const moment = messages[index]?.moment;
    if (loading || !moment) return;
    setMessageMoment(index, { ...moment, state: 'dismissed' });
  };

  // Take a saved moment back out of the journal
  const handleUndoMoment = (index) => {
    const moment = messages[index]?.moment;
    if (loading || !moment || !selectedChar) return;
    if (moment.entryId) removeJournalEntry(store, selectedChar.id, moment.entryId);
    setMessageMoment(index, { title: moment.title, state: 'dismissed' });
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
      const edited = { role: 'user', text: trimmed, ...(messages[index].style === 'dm' && { style: 'dm' }) };
      streamReply([...messages.slice(0, index), edited]);
    } else {
      persistMessages(
        messages.map((m, i) => {
          if (i !== index) return m;
          if (!m.alts) return { ...m, text: trimmed };
          return { ...m, text: trimmed, alts: m.alts.map((a, j) => (j === m.altIndex ? { ...a, text: trimmed } : a)) };
        })
      );
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
    setDirection('');
    setChatStyle('novel');
    setSelectedChar(created);
    setMessages([openingMessage(created)]);
    if (markRolePrompted(created.id)) setShowUserRole('auto');
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
    const chatMemories = {};
    const chatPins = {};
    const chatJournals = {};
    const chatStyles = {};
    for (const char of [...customChars, ...DEFAULT_CHARACTERS]) {
      if (store.getItem(chatStyleKey(char.id)) === 'dm') chatStyles[char.id] = 'dm';
      const saved = store.getItem(`chat_history_${char.id}`);
      if (saved) chatHistories[char.id] = JSON.parse(saved);
      const memory = store.getItem(memoryKey(char.id));
      if (saved && memory) chatMemories[char.id] = JSON.parse(memory);
      const pins = readPins(store, char.id);
      if (pins.length > 0) chatPins[char.id] = pins;
      const journal = readJournal(store, char.id);
      if (journal.length > 0) chatJournals[char.id] = journal;
    }

    const backup = {
      app: 'my-ai-roleplay',
      version: 1,
      exportedAt: new Date().toISOString(),
      customCharacters: customChars,
      chatHistories,
      chatMemories,
      chatPins,
      chatJournals,
      chatStyles,
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
    link.download = `botbaat-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
          // The file's memory belongs to this history; readMemory() drops it if it doesn't match
          const memory = backup.chatMemories?.[id];
          if (memory) store.setItem(memoryKey(id), JSON.stringify(memory));
          else store.removeItem(memoryKey(id));
          // Novel or DM mode goes with the chat (backups from before chatStyles leave it as it is)
          if (backup.chatStyles) {
            if (backup.chatStyles[id] === 'dm') store.setItem(chatStyleKey(id), 'dm');
            else store.removeItem(chatStyleKey(id));
          }
        }
      }
      for (const [id, pins] of Object.entries(backup.chatPins || {})) {
        const cleaned = Array.isArray(pins) ? cleanPins(pins) : [];
        if (knownIds.has(id) && cleaned.length > 0) store.setItem(pinsKey(id), JSON.stringify(cleaned));
      }
      for (const [id, journal] of Object.entries(backup.chatJournals || {})) {
        const valid = Array.isArray(journal) ? journal.filter((e) => e && e.id && typeof e.title === 'string') : [];
        if (knownIds.has(id) && valid.length > 0) store.setItem(journalKey(id), JSON.stringify(valid));
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
    store.removeItem(pinsKey(charId));
    store.removeItem(journalKey(charId));
    store.removeItem(chatStyleKey(charId));
    handleSaveUserRole(charId, normalizeUserRole(null));

    if (selectedChar?.id === charId) {
      activeCharIdRef.current = null;
      setSelectedChar(null);
      setMessages([]);
    }
  };

  const openMemory = () => {
    if (!selectedChar) return;
    const memory = readMemory(store, selectedChar.id, messages);
    setMemoryView({
      summary: memory ? memory.summary : null,
      pins: readPins(store, selectedChar.id),
      journal: readJournal(store, selectedChar.id),
    });
  };

  const handleSaveMemory = ({ pins, summary }) => {
    if (!selectedChar) return;
    const charId = selectedChar.id;
    const cleaned = cleanPins(pins);
    if (cleaned.length > 0) store.setItem(pinsKey(charId), JSON.stringify(cleaned));
    else store.removeItem(pinsKey(charId));
    const memory = readMemory(store, charId, messages);
    if (memory && summary !== null && summary !== memory.summary) {
      if (summary) store.setItem(memoryKey(charId), JSON.stringify({ ...memory, summary }));
      else store.removeItem(memoryKey(charId));
    }
  };

  const handleRenameJournalEntry = (entryId, title) => {
    if (!selectedChar) return;
    renameJournalEntry(store, selectedChar.id, entryId, title);
    setMemoryView((view) => view && { ...view, journal: readJournal(store, selectedChar.id) });
  };

  const handleDeleteJournalEntry = async (entry) => {
    if (!selectedChar) return;
    const ok = await askConfirm({
      title: `ลบ "${entry.title}"?`,
      text: 'ความทรงจำนี้จะหายจากสมุด และตัวละครจะไม่ได้รับรู้อีก',
      confirmLabel: 'ลบความทรงจำ',
      danger: true,
    });
    if (!ok) return;
    removeJournalEntry(store, selectedChar.id, entry.id);
    setMemoryView((view) => view && { ...view, journal: readJournal(store, selectedChar.id) });
    // The reply it came from no longer shows it as saved
    const index = messages.findIndex((m) => m.moment?.entryId === entry.id);
    if (index >= 0) setMessageMoment(index, { title: messages[index].moment.title, state: 'dismissed' });
  };

  // Drop the summary after asking; the next replies rebuild it from the chat. Resolves true when dropped.
  const handleForgetSummary = async () => {
    if (!selectedChar) return false;
    const charId = selectedChar.id;
    const ok = await askConfirm({
      title: 'ล้างสรุปเรื่องที่ผ่านมา?',
      text: 'สรุปนี้จะหายไป แอปจะค่อยๆ สรุปใหม่จากแชทเดิมหลังข้อความถัดๆ ไป หมุดและสมุดความทรงจำไม่หาย',
      confirmLabel: 'ล้างสรุป',
      danger: true,
    });
    if (ok) store.removeItem(memoryKey(charId));
    return ok;
  };

  // Clear chat history for the currently active character
  const handleClearHistory = async () => {
    if (!selectedChar) return;
    const char = selectedChar;
    const ok = await askConfirm({
      title: 'เริ่มคุยใหม่ตั้งแต่ต้น?',
      text: `ข้อความทั้งหมดกับ ${char.name} จะถูกล้าง แล้วเริ่มจากคำทักทายแรกอีกครั้ง (หมุดและสมุดความทรงจำยังอยู่)`,
      confirmLabel: 'ล้างแชท',
      danger: true,
      avatar: char.avatar,
    });
    if (!ok || activeCharIdRef.current !== char.id) return;
    stopStreaming({ discard: true });
    dropChat(char.id);
    setMessages([openingMessage(char)]);
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
      setMessages([openingMessage(char)]);
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
        collapsed={sidebarCollapsed}
        onCollapse={() => toggleSidebar(true)}
      />

      {/* Center: the open chat, or the character grid when no chat is open */}
      {selectedChar ? (
        <ChatWindow
          selectedChar={selectedChar}
          onBack={handleBack}
          messages={messages}
          loading={loading}
          waiting={waiting}
          input={input}
          setInput={setInput}
          onSendMessage={handleSendMessage}
          onContinue={handleContinue}
          onSuggest={handleSuggest}
          suggesting={suggesting === selectedChar.id}
          onClearHistory={handleClearHistory}
          onStopReply={handleStopReply}
          onRegenerate={handleRegenerate}
          onSwipe={handleSwipe}
          onSaveMoment={handleSaveMoment}
          onDismissMoment={handleDismissMoment}
          onUndoMoment={handleUndoMoment}
          chatStyle={chatStyle}
          onToggleChatStyle={handleToggleChatStyle}
          showRelation={responseSettings.relationship}
          showChoices={responseSettings.suggestions}
          onPickChoice={setInput}
          onOpenMemory={openMemory}
          direction={direction}
          setDirection={setDirection}
          onRetry={handleRetry}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          hasUserRole={Boolean(userRoles[selectedChar.id])}
          onOpenUserRole={() => setShowUserRole(true)}
          onExpandSidebar={sidebarCollapsed ? () => toggleSidebar(false) : undefined}
        />
      ) : (
        <CharacterBrowser
          characters={characters}
          onSelectChar={openProfile}
          onDeleteChar={handleDeleteCharacter}
          onEditChar={handleEditCharacter}
          onOpenCreateModal={() => setShowCreateModal(true)}
          onOpenHistory={() => setShowHistory(true)}
          onExpandSidebar={sidebarCollapsed ? () => toggleSidebar(false) : undefined}
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

      {/* Who a character is, before chatting */}
      <CharacterProfile
        character={profileView?.character}
        status={profileView?.status}
        hasChat={profileView?.hasChat}
        role={profileView ? mergeUserProfile(userProfile, userRoles[profileView.character.id]) : null}
        onClose={closeProfile}
        onStartChat={startChatFromProfile}
        onEditRole={() => {
          setRoleFor(profileView.character);
          setShowUserRole(true);
        }}
        onEdit={profileView?.character.id.startsWith('custom_') ? () => {
          const char = profileView.character;
          setProfileView(null);
          handleEditCharacter(char);
        } : undefined}
      />

      {/* What the open character remembers */}
      <MemoryModal
        isOpen={Boolean(memoryView)}
        onClose={() => setMemoryView(null)}
        character={selectedChar}
        summary={memoryView?.summary ?? null}
        pins={memoryView?.pins}
        journal={memoryView?.journal}
        onRenameJournalEntry={handleRenameJournalEntry}
        onDeleteJournalEntry={handleDeleteJournalEntry}
        onSave={handleSaveMemory}
        onForgetSummary={handleForgetSummary}
        askConfirm={askConfirm}
      />

      {/* Per-character user role modal */}
      <UserRoleModal
        isOpen={Boolean(showUserRole)}
        firstTime={showUserRole === 'auto'}
        askConfirm={askConfirm}
        onClose={() => {
          setShowUserRole(false);
          setRoleFor(null);
        }}
        character={roleFor || selectedChar}
        role={(roleFor || selectedChar) ? userRoles[(roleFor || selectedChar).id] : null}
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
