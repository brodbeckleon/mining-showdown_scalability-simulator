import type { Metadata } from "next";
import SessionPageClient from "./_session-client";

export const metadata: Metadata = {
  title: "Game Session",
  description: "Live Mining Showdown game session.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SessionPage() {
  return <SessionPageClient />;
}
