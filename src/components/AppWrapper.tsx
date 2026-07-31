"use client";

import React, { useEffect, useState } from "react";
import BootSequence from "./BootSequence";

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const [showBoot, setShowBoot] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleBootComplete = () => {
    setShowBoot(false);
  };

  if (!isMounted) return <div className="h-screen w-full bg-[#020508]"></div>;

  return (
    <>
      {showBoot ? (
        <BootSequence onComplete={handleBootComplete} />
      ) : (
        children
      )}
    </>
  );
}
