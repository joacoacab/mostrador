"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clearTokens, fetchMe, type MeResponse } from "@/lib/auth";

export default function ProtectedPanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMe().then((me) => {
      if (!active) return;
      if (!me) {
        router.replace("/panel/login");
        return;
      }
      setUser(me);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  if (checking) {
    return <main className="flex flex-1 items-center justify-center">Cargando...</main>;
  }

  function handleLogout() {
    clearTokens();
    router.push("/panel/login");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <span className="font-semibold">Mostrador</span>
        <div className="flex items-center gap-4 text-sm">
          <span>{user?.nombre}</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-gray-900">
            Salir
          </button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
