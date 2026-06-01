import type { Metadata } from "next";
import CreatePageClient from "./_create-client";

export const metadata: Metadata = {
  title: "Host a Game",
  description:
    "Create a private Mining Showdown multiplayer session and invite others with a unique join link and QR code.",
  alternates: {
    canonical: "/create",
  },
};

export default function CreatePage() {
  return <CreatePageClient />;
}
