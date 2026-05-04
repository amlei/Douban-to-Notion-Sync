import "./src/env.js";

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    const backendURL =
      process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000";
    // Only proxy WebSocket -- REST API uses Route Handlers for cookie forwarding
    return [
      {
        source: "/api/community/ws",
        destination: `${backendURL}/api/community/ws`,
        has: [{ type: "header", key: "Upgrade", value: "websocket" }],
      },
    ];
  },
};
