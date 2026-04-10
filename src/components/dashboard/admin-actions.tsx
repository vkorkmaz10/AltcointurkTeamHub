"use client";

import { useState } from "react";
import { approveUser, rejectUser } from "@/actions/settings";

interface AdminActionsProps {
  userId: string;
  type: "pending";
}

export function AdminActions({ userId }: AdminActionsProps) {
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    await approveUser(userId);
    setLoading(false);
  }

  async function handleReject() {
    if (!confirm("Bu kullanıcıyı reddetmek istediğinize emin misiniz?")) return;
    setLoading(true);
    await rejectUser(userId);
    setLoading(false);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleApprove}
        disabled={loading}
        className="btn-success text-xs py-2 px-3"
      >
        ✓ Onayla
      </button>
      <button
        onClick={handleReject}
        disabled={loading}
        className="btn-danger text-xs py-2 px-3"
      >
        ✗ Reddet
      </button>
    </div>
  );
}
