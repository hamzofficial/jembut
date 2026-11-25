"use client";

import { useEffect } from "react";

export default function AntiInspectProtection() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }

      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j")) {
        e.preventDefault();
        return false;
      }

      if (e.ctrlKey && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        return false;
      }

      if (e.metaKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j")) {
        e.preventDefault();
        return false;
      }

      if (e.metaKey && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        return false;
      }
    };

    let debuggerInterval: NodeJS.Timeout;

    const startDebuggerTrap = () => {
      debuggerInterval = setInterval(() => {
        debugger;
      }, 100);
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    startDebuggerTrap();

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      clearInterval(debuggerInterval);
    };
  }, []);

  return null;
}