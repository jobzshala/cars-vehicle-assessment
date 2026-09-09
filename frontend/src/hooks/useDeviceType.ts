import useMediaQuery from "@mui/material/useMediaQuery";

export type DeviceType = "mobile" | "tablet" | "desktop";

export const BREAKPOINTS = {
  mobileMax: 640,
  tabletMax: 1023,
} as const;

export function useDeviceType(): DeviceType {
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.mobileMax}px)`);
  const isTablet = useMediaQuery(
    `(min-width:${BREAKPOINTS.mobileMax + 1}px) and (max-width:${BREAKPOINTS.tabletMax}px)`,
  );

  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}
