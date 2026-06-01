import type { Metadata } from "next";
import JoinCodePageClient from "./_join-code-client";

export const metadata: Metadata = {
  title: "Join Game Session",
  description: "Join a Mining Showdown game session with your team.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function JoinCodePage() {
  return <JoinCodePageClient />;
}
