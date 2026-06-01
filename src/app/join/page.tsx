import type { Metadata } from "next";
import JoinPageClient from "./_join-client";

export const metadata: Metadata = {
  title: "Join Session",
  description:
    "Join a Mining Showdown game session with your session code. Enter your team name and start competing.",
  alternates: {
    canonical: "/join",
  },
};

export default function JoinPage() {
  return <JoinPageClient />;
}
