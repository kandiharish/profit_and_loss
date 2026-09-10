"use client";

import { ReactLenis } from "@studio-freight/react-lenis";
import { ReactNode } from "react";

export default function LenisProvider({ children }: { children: ReactNode }) {
  return <ReactLenis root>{children}</ReactLenis>;
}
