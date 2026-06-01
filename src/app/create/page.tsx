import type { Metadata } from "next";
import CreatePageClient from "./_create-client";

export const metadata: Metadata = {
  title: "Create Session",
  description:
    "Create a private Mining Showdown game session for your class. Generates a unique join link and QR code for students.",
  alternates: {
    canonical: "/create",
  },
};

export default function CreatePage() {
  return <CreatePageClient />;
}
