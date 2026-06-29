import React from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      {/* Ambient cyan glow — decorative only, pointer-events-none */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 left-1/4 w-[600px] h-[300px] rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute top-1/2 -right-48 w-[400px] h-[400px] rounded-full bg-cyan-400/8 blur-[160px]" />
        <div className="absolute bottom-24 left-1/3 w-[500px] h-[200px] rounded-full bg-cyan-600/8 blur-[120px]" />
      </div>

      <AppHeader />
      <main className="relative z-10 flex-1 w-full max-w-3xl mx-auto px-4 py-6 pb-28">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
