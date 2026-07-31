import type { Metadata } from "next";
import { Orbitron, Rajdhani, JetBrains_Mono, Space_Grotesk } from "next/font/google";
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

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ALFRED",
  description: "Productivity Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${orbitron.variable} ${rajdhani.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} antialiased font-body bg-[#020508] text-[#DFF6FF]`}
      >
        <TaskProvider>
          <GoalProvider>
            <ProjectProvider>
              <WorkspaceProvider>
                <AppWrapper>
                  <div className="flex flex-col h-screen w-full bg-transparent overflow-hidden">
                    <TopCommandBar />
                    <div className="flex flex-1 overflow-hidden">
                      <Sidebar />
                      <main className="flex-1 overflow-y-auto w-full relative">
                        {children}
                      </main>
                    </div>
                    <BottomSystemBar />
                  </div>
                  <CommandTerminal />
                </AppWrapper>
              </WorkspaceProvider>
            </ProjectProvider>
          </GoalProvider>
        </TaskProvider>
      </body>
    </html>
  );
}
