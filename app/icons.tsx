type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

function Svg({
  size = 20,
  strokeWidth = 1.8,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const PlayCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l6 3.5-6 3.5v-7z" fill="currentColor" stroke="none" />
  </Svg>
);

export const ArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const ArrowDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M18 13l-6 6-6-6" />
  </Svg>
);

export const ArrowUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const Coin = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5v9M9.3 9.6c0-1 1.1-1.8 2.7-1.8s2.7.8 2.7 1.7c0 2.3-5.4 1.5-5.4 3.9 0 1 1.2 1.8 2.7 1.8s2.7-.8 2.7-1.8" />
  </Svg>
);

export const MusicNote = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 18V5l10-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="16" cy="16" r="3" />
  </Svg>
);

export const CreditCard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18M7 14h4" />
  </Svg>
);

export const Api = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6 4 12l5 6M15 6l5 6-5 6" />
  </Svg>
);

export const Lyrics = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h11M4 11h11M4 16h7" />
    <circle cx="19" cy="16" r="2.4" />
    <path d="M21.4 16V6l-3 1" />
  </Svg>
);

export const Settings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
      <line key={deg} x1="12" y1="4" x2="12" y2="6.4" transform={`rotate(${deg} 12 12)`} />
    ))}
  </Svg>
);

export const Album = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const CheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.2 12.5l2.6 2.6 5-5.2" />
  </Svg>
);

export const CheckSmall = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.2 4.2L19 6.5" />
  </Svg>
);

export const ShieldCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l7 3v6c0 5-3 7.5-7 9-4-1.5-7-4-7-9V6l7-3z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </Svg>
);

export const Lock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);

export const Copy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="12" height="12" rx="2" />
    <path d="M9 20h9a2 2 0 0 0 2-2V9" />
  </Svg>
);

export const Mic = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
  </Svg>
);

export const Edit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4l11-11-4-4L4 16v4z" />
    <path d="M14 5l4 4" />
  </Svg>
);

export const AlertTriangle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 3 20h18L12 4z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);

export const GraduationCap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 8l10-4 10 4-10 4-10-4z" />
    <path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
  </Svg>
);

export const Storefront = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10l1-5h14l1 5" />
    <path d="M4 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    <path d="M5 10v9h14v-9" />
  </Svg>
);

export const Gift = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="9" width="16" height="11" rx="1" />
    <path d="M4 13h16M12 9v11" />
    <path d="M12 9C9 9 8 6.5 9.5 5 11 3.5 12 6 12 9zM12 9c3 0 4-2.5 2.5-4C13 3.5 12 6 12 9z" />
  </Svg>
);

export const Refresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
    <path d="M18 4v4h-4M6 20v-4h4" />
  </Svg>
);

export const Bolt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 3 5 14h6l-1 7 9-11h-6l0-7z" fill="currentColor" stroke="none" />
  </Svg>
);

export const Loader = ({ className, ...rest }: IconProps) => (
  <Svg {...rest} className={className ? `${className} spin` : "spin"}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Svg>
);

export const UserCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3" />
    <path d="M6 18.2c1.2-2.2 3.4-3.4 6-3.4s4.8 1.2 6 3.4" />
  </Svg>
);

export const Plus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
  </Svg>
);
