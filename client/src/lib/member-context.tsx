import { createContext, useContext, useState, useCallback } from "react";
import { MEMBER_NAMES, type MemberName } from "@shared/schema";

interface MemberContextValue {
  currentMember: MemberName | null;
  setCurrentMember: (name: MemberName | null) => void;
}

const MemberContext = createContext<MemberContextValue | null>(null);

function getSavedMember(): MemberName | null {
  try {
    const saved = localStorage.getItem("esteraha_current_member");
    if (saved && MEMBER_NAMES.includes(saved as MemberName)) return saved as MemberName;
  } catch {
    // ignore
  }
  return null;
}

export function MemberProvider({ children }: { children: React.ReactNode }) {
  const [currentMember, setCurrentMemberState] = useState<MemberName | null>(getSavedMember);

  const setCurrentMember = useCallback((name: MemberName | null) => {
    setCurrentMemberState(name);
    try {
      if (name) localStorage.setItem("esteraha_current_member", name);
      else localStorage.removeItem("esteraha_current_member");
    } catch {
      // ignore
    }
  }, []);

  return (
    <MemberContext.Provider value={{ currentMember, setCurrentMember }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMember() {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error("useMember must be used within MemberProvider");
  return ctx;
}
