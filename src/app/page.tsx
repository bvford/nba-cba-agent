"use client";

import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LandingContent } from "@/components/landing/LandingContent";
import { Sidebar } from "@/components/Sidebar";
import { Toast } from "@/components/Toast";
import { useChat } from "@/lib/use-chat";

// useChat() reads the `ask` search param (for /teams -> chat handoff), and
// Next.js requires a Suspense boundary around any client-side useSearchParams()
// call or `next build` fails.
export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-gradient-page" />}>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const {
    chats,
    activeChatId,
    messages,
    isLoading,
    sidebarOpen,
    setSidebarOpen,
    draft,
    setDraft,
    editingIndex,
    messagesEndRef,
    chatPendingDelete,
    toast,
    dismissToast,
    startNewChat,
    selectChat,
    requestDeleteChat,
    cancelDeleteChat,
    confirmDeleteChat,
    sendMessage,
    handleInputSend,
    regenerateLast,
    retryError,
    exportChat,
    handleFeedback,
    beginEditUserMessage,
    cancelEdit,
    goToChatComposer,
    canRegenerate,
    isLanding,
  } = useChat();

  return (
    <div className="relative isolate flex h-screen w-full overflow-x-hidden bg-gradient-page">
      <div className="flex h-screen w-full max-w-[1600px] mx-auto">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectChat={selectChat}
        onNewChat={startNewChat}
        onDeleteChat={requestDeleteChat}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <AppHeader
          sidebarOpen={sidebarOpen}
          hasMessages={messages.length > 0}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onNewChat={startNewChat}
          onGoToComposer={goToChatComposer}
          onExportChat={exportChat}
        />

        <main id="chat" className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 w-full">
            {isLanding ? (
              <LandingContent onSelectPrompt={sendMessage} onStartChat={goToChatComposer} />
            ) : (
              <div className="max-w-3xl mx-auto w-full">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={index}
                    role={message.role}
                    content={message.content}
                    sources={message.sources}
                    feedback={message.feedback}
                    isError={message.isError}
                    onFeedback={(value) => handleFeedback(index, value)}
                    onEditResend={
                      message.role === "user" ? () => beginEditUserMessage(index) : undefined
                    }
                    onRetry={message.isError ? () => retryError(index) : undefined}
                    isStreaming={isLoading && index === messages.length - 1 && message.role === "assistant"}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <ChatInput
          value={draft}
          onValueChange={setDraft}
          onSend={handleInputSend}
          disabled={isLoading}
          isEditing={editingIndex !== null}
          onCancelEdit={cancelEdit}
          onRegenerate={regenerateLast}
          canRegenerate={canRegenerate}
        />
      </div>
      </div>

      {chatPendingDelete && (
        <ConfirmDialog
          title="Delete chat?"
          description={`Delete this chat${chatPendingDelete.title ? `: "${chatPendingDelete.title}"` : ""}? This cannot be undone.`}
          onCancel={cancelDeleteChat}
          onConfirm={confirmDeleteChat}
        />
      )}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
