import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Off on purpose: Strict Mode's dev-only double mount would join, leave and
  // rejoin the call, and a double mount must never end or create a paid call.
  reactStrictMode: false,
  // Keeps next dev from writing a docs file into the project root.
  agentRules: false,
};

export default nextConfig;
