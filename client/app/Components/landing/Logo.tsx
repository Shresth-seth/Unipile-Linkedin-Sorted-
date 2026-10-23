import React from "react";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  forceWhite?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = "",
  showText = true,
  size = "md",
  forceWhite = false,
}) => {
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-7 h-7",
    lg: "w-9 h-9",
  };

  const textSizes = {
    sm: "text-base tracking-tight",
    md: "text-lg tracking-tight",
    lg: "text-xl tracking-tight",
  };

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
    >
      {/* Network / Orbit Icon */}
      <div
        className={`relative flex items-center justify-center ${iconSizes[size]}`}
      >
        {/* Subtle background glow */}
        <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-sm pointer-events-none" />

        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10"
        >
          <defs>
            <linearGradient
              id="WORKPILOTRing"
              x1="4"
              y1="4"
              x2="32"
              y2="32"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.9" />
            </linearGradient>

            <linearGradient
              id="WORKPILOTLine"
              x1="12"
              y1="10"
              x2="26"
              y2="24"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.6" />
            </linearGradient>

            <radialGradient id="WORKPILOTCenterNode" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="60%" stopColor="#00E5FF" />
              <stop offset="100%" stopColor="#38BDF8" />
            </radialGradient>
          </defs>

          {/* Outer Orbital Ring */}
          <circle
            cx="18"
            cy="18"
            r="14"
            stroke="url(#WORKPILOTRing)"
            strokeWidth="1.5"
            strokeDasharray="5 3"
            className="opacity-70"
          />

          {/* Connected Network Paths */}
          <path
            d="M18 10L25 21L12 23Z"
            stroke="url(#WORKPILOTLine)"
            strokeWidth="1.2"
            strokeLinejoin="round"
            className="opacity-80"
          />

          {/* Center Connector Lines to Nodes */}
          <line
            x1="18"
            y1="18"
            x2="18"
            y2="10"
            stroke="#38BDF8"
            strokeWidth="1.2"
            strokeOpacity="0.7"
          />
          <line
            x1="18"
            y1="18"
            x2="25"
            y2="21"
            stroke="#38BDF8"
            strokeWidth="1.2"
            strokeOpacity="0.7"
          />
          <line
            x1="18"
            y1="18"
            x2="12"
            y2="23"
            stroke="#38BDF8"
            strokeWidth="1.2"
            strokeOpacity="0.7"
          />

          {/* Peripheral Node 1 (Top) */}
          <circle cx="18" cy="10" r="2.2" fill="#00E5FF" />
          <circle
            cx="18"
            cy="10"
            r="4"
            stroke="#00E5FF"
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />

          {/* Peripheral Node 2 (Right bottom) */}
          <circle cx="25" cy="21" r="2" fill="#38BDF8" />
          <circle
            cx="25"
            cy="21"
            r="3.6"
            stroke="#38BDF8"
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />

          {/* Peripheral Node 3 (Left bottom) */}
          <circle cx="12" cy="23" r="1.8" fill="#3B82F6" />
          <circle
            cx="12"
            cy="23"
            r="3.2"
            stroke="#3B82F6"
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />

          {/* Intelligent Hub Node (Center) */}
          <circle cx="18" cy="18" r="2.8" fill="url(#WORKPILOTCenterNode)" />
          <circle
            cx="18"
            cy="18"
            r="5"
            stroke="#FFFFFF"
            strokeWidth="0.6"
            strokeOpacity="0.5"
          />
        </svg>
      </div>

      {/* Brand Text */}
      {showText && (
        <span
          className={`font-heading font-bold tracking-tight transition-colors ${textSizes[size]} ${
            forceWhite ? "text-white" : "text-slate-900 dark:text-white"
          }`}
        >
          WORKPILOT{" "}
          <span
            className={`font-medium ${
              forceWhite
                ? "text-slate-200"
                : "text-blue-600 dark:text-slate-200"
            }`}
          ></span>
        </span>
      )}
    </div>
  );
};

export default Logo;
