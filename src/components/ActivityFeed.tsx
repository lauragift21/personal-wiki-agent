import { useState, useEffect, useCallback } from "react";
import { Surface, Text, Badge, Button } from "@cloudflare/kumo";
import {
  ClockIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  GearIcon,
  CheckCircleIcon,
  RobotIcon,
  XIcon,
  ArrowCounterClockwiseIcon
} from "@phosphor-icons/react";

interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  details: string;
  timestamp: number;
  timeAgo: string;
  metadata?: Record<string, unknown>;
}

type ActivityType =
  | "ingest"
  | "query"
  | "schedule"
  | "task_execute"
  | "lint"
  | "mcp_connect"
  | "mcp_disconnect"
  | "system";

interface ActivityFeedProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any;
  isOpen: boolean;
  onClose: () => void;
}

const activityIcons: Record<ActivityType, React.ReactNode> = {
  ingest: <PlusIcon size={14} className="text-kumo-success" />,
  query: <MagnifyingGlassIcon size={14} className="text-kumo-brand" />,
  schedule: <CalendarIcon size={14} className="text-kumo-accent" />,
  task_execute: <CheckCircleIcon size={14} className="text-kumo-success" />,
  lint: <GearIcon size={14} className="text-kumo-warning" />,
  mcp_connect: <RobotIcon size={14} className="text-kumo-info" />,
  mcp_disconnect: <RobotIcon size={14} className="text-kumo-inactive" />,
  system: <ClockIcon size={14} className="text-kumo-subtle" />
};

const activityLabels: Record<ActivityType, string> = {
  ingest: "Document added",
  query: "Search performed",
  schedule: "Task scheduled",
  task_execute: "Task executed",
  lint: "Health check",
  mcp_connect: "MCP connected",
  mcp_disconnect: "MCP disconnected",
  system: "System"
};

const activityBadgeVariants: Record<
  ActivityType,
  "primary" | "secondary" | "success" | "warning" | "destructive"
> = {
  ingest: "success",
  query: "primary",
  schedule: "primary",
  task_execute: "success",
  lint: "warning",
  mcp_connect: "primary",
  mcp_disconnect: "secondary",
  system: "secondary"
};

export function ActivityFeed({ agent, isOpen, onClose }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<ActivityType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!agent) return;
    setIsLoading(true);
    try {
      const result = await agent.stub.getRecentActivities(
        20,
        filter || undefined
      );
      setActivities(result.activities);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setIsLoading(false);
    }
  }, [agent, filter]);

  useEffect(() => {
    if (isOpen) {
      fetchActivities();
    }
  }, [isOpen, fetchActivities]);

  // Listen for real-time activity updates
  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "activity") {
          setActivities((prev) => {
            const newActivity = data.activity as Activity;
            // Avoid duplicates
            if (prev.some((a) => a.id === newActivity.id)) {
              return prev;
            }
            return [newActivity, ...prev].slice(0, 50);
          });
          setTotal((prev) => prev + 1);
        }
      } catch {
        // Not our message
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-kumo-base border-l border-kumo-line shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-kumo-line flex items-center justify-between bg-kumo-elevated">
        <div className="flex items-center gap-2">
          <ClockIcon size={18} className="text-kumo-brand" />
          <Text size="sm" bold>
            Agent Activity
          </Text>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          aria-label="Close activity feed"
          icon={<XIcon size={16} />}
          onClick={onClose}
        />
      </div>

      {/* Filter tabs */}
      <div className="px-3 py-2 border-b border-kumo-line flex gap-1 overflow-x-auto">
        <Button
          variant={filter === null ? "primary" : "ghost"}
          size="sm"
          onClick={() => setFilter(null)}
        >
          All
        </Button>
        {(
          ["ingest", "query", "schedule", "task_execute"] as ActivityType[]
        ).map((type) => (
          <Button
            key={type}
            variant={filter === type ? "primary" : "ghost"}
            size="sm"
            onClick={() => setFilter(type)}
          >
            {activityLabels[type]}
          </Button>
        ))}
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Text size="sm" variant="secondary">
              Loading...
            </Text>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ClockIcon size={32} className="text-kumo-inactive mb-2" />
            <Text size="sm" variant="secondary">
              No activities yet
            </Text>
            <Text size="xs" variant="secondary">
              The agent will log actions here
            </Text>
          </div>
        ) : (
          activities.map((activity) => (
            <Surface
              key={activity.id}
              className="p-3 rounded-lg border border-kumo-line"
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{activityIcons[activity.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={activityBadgeVariants[activity.type]}>
                      {activityLabels[activity.type]}
                    </Badge>
                    <Text size="xs" variant="secondary">
                      {activity.timeAgo}
                    </Text>
                  </div>
                  <Text size="sm">{activity.subject}</Text>
                  <Text size="xs" variant="secondary">
                    {activity.details}
                  </Text>
                  {activity.metadata && activity.type === "ingest" && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {(activity.metadata.tags as string[])?.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Surface>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-kumo-line bg-kumo-elevated">
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowCounterClockwiseIcon size={14} />}
          onClick={fetchActivities}
          className="w-full"
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
