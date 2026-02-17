export interface Chat {
  id: string;
  title: string;
  messages: { role: "user" | "assistant"; content: string }[];
  createdAt: number;
}

const STORAGE_KEY = "nba-cba-chats";

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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Chat[];
  } catch {
    return [];
  }
}

export function saveChat(chat: Chat): void {
  const chats = loadChats();
  const idx = chats.findIndex((c) => c.id === chat.id);
  if (idx >= 0) {
    chats[idx] = chat;
  } else {
    chats.unshift(chat);
  }
  // Keep max 50 chats
  const trimmed = chats.slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function deleteChat(id: string): void {
  const chats = loadChats().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

export function createChat(firstMessage: string): Chat {
  return {
    id: generateId(),
    title: generateTitle(firstMessage),
    messages: [],
    createdAt: Date.now(),
  };
}
