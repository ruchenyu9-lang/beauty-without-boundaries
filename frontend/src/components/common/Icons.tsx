import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function HomeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

export function LipstickIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 21h6" />
      <path d="M10 21v-5.5h4V21" />
      <path d="M9 15.5h6V8.5L12 6 9 8.5v7Z" />
      <path d="m9 8.5-1.3-3.4L12 3l4.3 2.1L15 8.5" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
      <circle cx="18" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3a9 9 0 1 0 0 18h1.4a1.6 1.6 0 0 0 1.1-2.8 1.6 1.6 0 0 1 1.1-2.8h1.7A3.7 3.7 0 0 0 21 11.8C21 6.9 16.9 3 12 3Z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.4" cy="11.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11 2.2 12.9 8 18.7 9.9 12.9 11.8 11 17.6 9.1 11.8 3.3 9.9 9.1 8 11 2.2Z" />
      <path d="M18.6 14.4 19.5 17.3 22.4 18.2 19.5 19.1 18.6 22 17.7 19.1 14.8 18.2 17.7 17.3 18.6 14.4Z" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

export function EraserIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m4 15 8-8 7 7-6 6H8l-4-4Z" />
      <path d="M9 20h11" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 2.5-2.5L20 18" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function LightbulbIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5V17h8v-3.5A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 4 2.8 20h18.4L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ChatBubbleIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-5a3 3 0 0 1-1-2.2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v8Z" />
      <path d="M8 10h8" />
      <path d="M8 13h5" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 12h15" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}
