import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono, Orbitron, Rajdhani } from "next/font/google";
import "./globals.css";
import { TaskProvider } from "@/context/TaskContext";
import { GoalProvider } from "@/context/GoalContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import Sidebar from "@/components/Sidebar";
import AppWrapper from "@/components/AppWrapper";
import TopCommandBar from "@/components/TopCommandBar";
import BottomSystemBar from "@/components/BottomSystemBar";
import CommandTerminal from "@/components/CommandTerminal";
import MemoryVaultModal from "@/components/MemoryVaultModal";
import AutomationSchedulesModal from "@/components/AutomationSchedulesModal";
import SettingsModal from "@/components/SettingsModal";
import KnowledgeVaultModal from "@/components/KnowledgeVaultModal";
import FirstLaunchOnboardingModal from "@/components/FirstLaunchOnboardingModal";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

import AlfredEnvironment from "@/components/AlfredEnvironment";
import PageTransition from "@/components/PageTransition";

import { FocusProvider } from "@/context/FocusContext";

export const metadata: Metadata = {
  title: "ALFRED // Personal AI OS",
  description: "Cinematic Desktop AI Command Center & Personal AI Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${orbitron.variable} ${rajdhani.variable} antialiased font-sans bg-[#080A0F] text-[#E2E8F0] selection:bg-[#E11D48]/30 selection:text-white`}
      >
        <AlfredEnvironment />
        <TaskProvider>
          <GoalProvider>
            <ProjectProvider>
              <WorkspaceProvider>
                <FocusProvider>
                  <AppWrapper>
                    <div className="flex flex-col h-screen w-full bg-transparent overflow-hidden">
                      <TopCommandBar />
                      <div className="flex flex-1 overflow-hidden relative">
                        <Sidebar />
                        <main className="flex-1 overflow-y-auto w-full relative z-10">
                          <PageTransition>{children}</PageTransition>
                        </main>
                      </div>
                      <BottomSystemBar />
                    </div>
                    <CommandTerminal />
                    <MemoryVaultModal />
                    <AutomationSchedulesModal />
                    <SettingsModal />
                    <KnowledgeVaultModal />
                    <FirstLaunchOnboardingModal />
                  </AppWrapper>
                </FocusProvider>
              </WorkspaceProvider>
            </ProjectProvider>
          </GoalProvider>
        </TaskProvider>
      </body>
    </html>
  );
}
