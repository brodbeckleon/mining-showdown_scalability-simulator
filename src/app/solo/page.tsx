import type { Metadata } from "next";
import SoloPageClient from "./_solo-client";

export const metadata: Metadata = {
  title: "Solo Mode",
  description:
    "Race against AI bots in Mining Showdown Solo Mode. Choose your difficulty and outscale the competition.",
  alternates: {
    canonical: "/solo",
  },
};

export default function SoloPage() {
  return <SoloPageClient />;
}
