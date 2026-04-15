import { useState, useEffect } from "react";
import { Text, Badge } from "@cloudflare/kumo";
import { RobotIcon, PulseIcon } from "@phosphor-icons/react";

interface AgentPresenceProps {
  connected: boolean;
  agentStatus?: "ready" | "working" | "idle";
}

export function AgentPresence({
  connected,
  agentStatus = "idle"
}: AgentPresenceProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const statusConfig = {
    ready: {
      icon: <RobotIcon size={16} className="text-kumo-success" />,
      badge: "success" as const,
      text: "Agent ready",
      pulse: false
    },
    working: {
      icon: <PulseIcon size={16} className="text-kumo-brand animate-pulse" />,
      badge: "primary" as const,
      text: "Agent working...",
      pulse: true
    },
    idle: {
      icon: <RobotIcon size={16} className="text-kumo-inactive" />,
      badge: "secondary" as const,
      text: connected ? "Agent idle" : "Disconnected",
      pulse: false
    }
  };

  const config = statusConfig[agentStatus];

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded-lg border border-kumo-line bg-kumo-base ${config.pulse ? "ring-1 ring-kumo-brand/30" : ""}`}
      >
        <div className="relative">
          {config.icon}
          {config.pulse && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kumo-brand opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-kumo-brand"></span>
            </span>
          )}
        </div>
        <Badge variant={config.badge}>
          <Text size="xs">{config.text}</Text>
        </Badge>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-kumo-contrast text-kumo-inverse rounded-lg shadow-lg text-xs z-50">
          <div className="font-semibold mb-1">Agent Status</div>
          <div>Status: {agentStatus}</div>
          <div>Connection: {connected ? "Connected" : "Disconnected"}</div>
          <div className="mt-1 text-kumo-inverse/70">
            The agent monitors your wiki and executes scheduled tasks
            autonomously.
          </div>
          <div className="absolute bottom-0 left-4 translate-y-1/2 rotate-45 w-2 h-2 bg-kumo-contrast"></div>
        </div>
      )}
    </div>
  );
}
