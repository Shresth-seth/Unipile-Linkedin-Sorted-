import React from "react";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className = "",
}) => {
  const isCentered = align === "center";

  return (
    <div
      className={`max-w-3xl mb-12 sm:mb-16 ${
        isCentered ? "mx-auto text-center" : "text-left"
      } ${className}`}
    >
      {eyebrow && (
        <span className="inline-block text-[11px] font-mono font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3 select-none">
          {eyebrow}
        </span>
      )}
      <h2 className="text-2xl sm:text-4xl font-bold font-heading text-slate-950 dark:text-white tracking-tight leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300/90 leading-relaxed max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default SectionHeading;
