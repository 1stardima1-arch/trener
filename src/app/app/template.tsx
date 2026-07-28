import { PageTransition } from "@/components/motion/page-transition";

// Remounts on every navigation inside /app, replaying the enter animation
// and the Siri-style edge glow (see PageTransition).
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
