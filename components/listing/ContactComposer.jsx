"use client";

import React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const QUICK_REPLIES = ["Is this still available?", "What's your best price?", "Where can we meet on campus?"];

/**
 * The message box for contacting a seller — shared by the desktop card and the
 * mobile bottom sheet. Quick replies fill the box with one tap, because most
 * first messages are the same handful of questions.
 */
export default function ContactComposer({ message, setMessage, onSend, sending, negotiable = false, autoFocus = false }) {
  const chips = negotiable ? [...QUICK_REPLIES, "Can you do a lower price?"] : QUICK_REPLIES;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chips.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => setMessage(text)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-primary/40 hover:bg-blue-50 hover:text-primary active:scale-95"
          >
            {text}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={500}
        autoFocus={autoFocus}
        placeholder="Write a message to the seller…"
        className="w-full resize-none rounded-xl border border-input bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      <Button onClick={onSend} loading={sending} disabled={!message.trim()} size="lg" className="w-full">
        {!sending && <Send />}
        {sending ? "Sending…" : "Send message"}
      </Button>
    </div>
  );
}
