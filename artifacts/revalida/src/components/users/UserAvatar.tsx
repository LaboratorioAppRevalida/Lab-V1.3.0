import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { resolveImage } from "@/lib/storageService";

export type UserStatus = "online" | "offline" | "in_session" | "busy" | "matchmaking";
export type AvatarSize = "sm" | "md" | "lg" | "xl";

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  status?: UserStatus;
  size?: AvatarSize;
  className?: string;
}

const sizeStyles: Record<AvatarSize, { root: string; text: string; dot: string }> = {
  sm: {
    root: "w-8 h-8",
    text: "text-xs",
    dot: "w-2.5 h-2.5 -bottom-px -right-px border-[1.5px]",
  },
  md: {
    root: "w-10 h-10",
    text: "text-sm",
    dot: "w-3 h-3 -bottom-0.5 -right-0.5 border-2",
  },
  lg: {
    root: "w-16 h-16",
    text: "text-xl",
    dot: "w-4 h-4 -bottom-0.5 -right-0.5 border-2",
  },
  xl: {
    root: "w-24 h-24",
    text: "text-3xl",
    dot: "w-5 h-5 -bottom-0.5 -right-0.5 border-2",
  },
};

const dotColor: Record<UserStatus, string> = {
  online:      "bg-emerald-500",
  offline:     "bg-rose-500",
  in_session:  "bg-amber-500",
  busy:        "bg-orange-500",
  matchmaking: "bg-blue-500",
};

export function UserAvatar({
  name,
  avatarUrl,
  status,
  size = "md",
  className,
}: UserAvatarProps) {
  const { root, text, dot } = sizeStyles[size];

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className={cn(root, "border border-border/40")}>
        {avatarUrl && (
          <AvatarImage src={resolveImage(avatarUrl, "avatars")} alt={name} className="object-cover" />
        )}
        <AvatarFallback
          className={cn(
            "bg-gradient-to-br from-blue-500/30 via-cyan-400/30 to-violet-500/30 font-bold text-foreground",
            text,
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {status && (
        <span
          className={cn(
            "absolute rounded-full border-background",
            dot,
            dotColor[status],
          )}
        />
      )}
    </div>
  );
}
