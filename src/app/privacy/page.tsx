export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-page">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-[--color-text-primary] tracking-tight mb-3">
          Privacy
        </h1>
        <p className="text-sm text-[--color-text-secondary] leading-relaxed">
          ChatCBA stores recent chats in your local browser storage for convenience. Usage analytics may be
          collected in aggregate to understand product behavior and improve the experience. Do not enter
          sensitive personal, legal, or financial information.
        </p>
      </div>
    </main>
  );
}
