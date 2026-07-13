import type { Message } from "@/lib/chat-types";

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const STORAGE_KEY = "nba-cba-chats";
const SCHEMA_VERSION = 1;
const MAX_CHATS = 50;

interface StoredChats {
  schemaVersion: number;
  chats: Chat[];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function generateTitle(firstMessage: string): string {
  // Trim to first ~50 chars, cut at word boundary
  const trimmed = firstMessage.slice(0, 60);
  const atWord = trimmed.lastIndexOf(" ");
  return (atWord > 30 ? trimmed.slice(0, atWord) : trimmed) + (firstMessage.length > 60 ? "..." : "");
}

export function loadChats(): Chat[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn("Could not parse saved chats; discarding invalid local data.", error);
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }

  if (Array.isArray(parsed)) {
    const legacyChats = parsed.filter(isChat).slice(0, MAX_CHATS);
    writeChats(legacyChats);
    return legacyChats;
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.chats)) {
    console.warn("Saved chats use an unsupported schema and were discarded.");
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }

  const validChats = parsed.chats.filter(isChat).slice(0, MAX_CHATS);
  if (validChats.length !== parsed.chats.length) {
    console.warn("Some invalid saved chats were discarded.");
    writeChats(validChats);
  }
  return validChats;
}

export function saveChat(chat: Chat): void {
  const chats = loadChats();
  const idx = chats.findIndex((c) => c.id === chat.id);
  if (idx >= 0) {
    chats[idx] = chat;
  } else {
    chats.unshift(chat);
  }
  writeChats(chats.slice(0, MAX_CHATS));
}

export function deleteChat(id: string): void {
  const chats = loadChats().filter((c) => c.id !== id);
  writeChats(chats);
}

export function createChat(firstMessage: string): Chat {
  return {
    id: generateId(),
    title: generateTitle(firstMessage),
    messages: [],
    createdAt: Date.now(),
  };
}

function writeChats(chats: Chat[]): void {
  const payload: StoredChats = {
    schemaVersion: SCHEMA_VERSION,
    chats: chats.slice(0, MAX_CHATS),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function isChat(value: unknown): value is Chat {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.createdAt === "number" &&
    Array.isArray(value.messages) &&
    value.messages.every(isMessage)
  );
}

function isMessage(value: unknown): value is Message {
  return (
    isRecord(value) &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    (value.sources === undefined ||
      (Array.isArray(value.sources) && value.sources.every((source) => typeof source === "string"))) &&
    (value.feedback === undefined || value.feedback === "up" || value.feedback === "down") &&
    (value.isError === undefined || typeof value.isError === "boolean")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
