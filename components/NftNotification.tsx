"use client";

import { useEffect, useState } from "react";

interface NftNotificationProps {
  tokenId: string;
  onClose: () => void;
}

export default function NftNotification({ tokenId, onClose }: NftNotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 400);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-400
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
    >
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl
        bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20
        border border-amber-500/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(251,191,36,0.25)]"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
          <span className="text-xl">🏛️</span>
        </div>
        <div>
          <p className="text-white font-bold text-sm">Temple Explorer NFT Minted!</p>
          <p className="text-amber-300/80 text-xs">Token #{tokenId} is now yours</p>
        </div>
        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 400); }}
          className="ml-2 text-white/40 hover:text-white/80 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
