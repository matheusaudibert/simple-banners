import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // não gerar AGENTS.md / CLAUDE.md a cada `next dev`
  agentRules: false,
};

export default nextConfig;
