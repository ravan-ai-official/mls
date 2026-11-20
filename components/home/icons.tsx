import type { SVGProps } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Homepage line icons, ported from HomeAtlasUI
 * (`src/imports/Html→Body/svg-ckktjp5vkf.ts`). Path data is copied verbatim;
 * the reference's hard-coded #C7A45A stroke is replaced by `currentColor` with
 * a `text-gold` default, so callers can recolour via className.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "viewBox"> & { size?: number };

function makeIcon(viewBox: string, paths: string[], displayName: string) {
  function Icon({ size = 24, className, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={cn("shrink-0 text-gold", className)}
        {...rest}
      >
        {paths.map((d) => (
          <path
            key={d}
            d={d}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        ))}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

const P = {
  houseDoor:
    "M13 20.0005V12.0005C13 11.4486 12.5519 11.0005 12 11.0005H8C7.44808 11.0005 7 11.4486 7 12.0005V20.0005",
  houseBody:
    "M1 9.00048C0.999859 8.41161 1.25924 7.8526 1.709 7.47248L8.709 1.47248C9.45439 0.842507 10.5456 0.842507 11.291 1.47248L18.291 7.47248C18.7408 7.8526 19.0001 8.41161 19 9.00048V18.0005C19 19.1043 18.1038 20.0005 17 20.0005H3C1.89617 20.0005 1 19.1043 1 18.0005V9.00048",
  keyShaft:
    "M14.5 6.5L16.8 8.8C17.1888 9.18114 17.8112 9.18114 18.2 8.8L20.3 6.7C20.6811 6.31116 20.6811 5.68884 20.3 5.3L18 3M20 1L10.4 10.6",
  keyRing:
    "M1 14.5C1 17.5355 3.46447 20 6.5 20C9.53553 20 12 17.5355 12 14.5C12 11.4645 9.53553 9 6.5 9C3.46447 9 1 11.4645 1 14.5V14.5",
  preconWindows:
    "M9 10H13M9 6H13M13 19V16C13 14.8962 12.1038 14 11 14C9.89617 14 9 14.8962 9 16V19",
  preconWing:
    "M5 8H3C1.89617 8 1 8.89617 1 10V17C1 18.1038 1.89617 19 3 19H19C20.1038 19 21 18.1038 21 17V7C21 5.89617 20.1038 5 19 5H17",
  preconTower: "M5 19V3C5 1.89617 5.89617 1 7 1H15C16.1038 1 17 1.89617 17 3V19",
  chartAxis: "M1 1V17C1 18.1038 1.89617 19 3 19H19",
  chartLine: "M17 7L12 12L8 8L5 11",
  gemFacets:
    "M9.50033 1.00026L7.00033 7.00026L11.0003 20.0003L15.0003 7.00026L12.5003 1.00026",
  gemOutline:
    "M16.0003 1.00026C16.6298 1.00026 17.2226 1.29665 17.6003 1.80026L20.6003 5.80026C21.1286 6.50482 21.1339 7.47198 20.6133 8.18226L12.6233 19.1683C12.2475 19.6906 11.6433 20.0003 10.9998 20.0003C10.3563 20.0003 9.75214 19.6906 9.37633 19.1683L1.38633 8.18226C0.866093 7.47176 0.871778 6.50459 1.40033 5.80026L4.39833 1.80326C4.77583 1.29795 5.36959 1.00034 6.00033 1.00026L16.0003 1.00026M1.00033 7.00026H21.0003",
  calendarRings: "M6 1V5M14 1V5",
  calendarBody:
    "M3 3H17C18.1038 3 19 3.89617 19 5V19C19 20.1038 18.1038 21 17 21H3C1.89617 21 1 20.1038 1 19V5C1 3.89617 1.89617 3 3 3V3",
  calendarDays:
    "M1 9H19M6 13H6.01M10 13H10.01M14 13H14.01M6 17H6.01M10 17H10.01M14 17H14.01",
  rentalKey:
    "M1.586 16.4524C1.2109 16.8274 1.00011 17.336 1 17.8664V20.0384C1 20.5903 1.44808 21.0384 2 21.0384H5C5.55192 21.0384 6 20.5903 6 20.0384V19.0384C6 18.4865 6.44808 18.0384 7 18.0384H8C8.55192 18.0384 9 17.5903 9 17.0384V16.0384C9 15.4865 9.44808 15.0384 10 15.0384H10.172C10.7024 15.0383 11.211 14.8275 11.586 14.4524L12.4 13.6384C15.2622 14.6354 18.4336 13.522 20.0444 10.9545C21.6551 8.38705 21.2776 5.04712 19.1344 2.90395C16.9913 0.760786 13.6513 0.383285 11.0839 1.99403C8.51641 3.60477 7.40296 6.77617 8.4 9.63839L1.586 16.4524",
};

/** House — reference "Buy" card and "Detached" tile share this glyph. */
export const IconBuy = makeIcon("0 0 20 21.0005", [P.houseDoor, P.houseBody], "IconBuy");
export const IconDetached = makeIcon(
  "0 0 20 21.0005",
  [P.houseDoor, P.houseBody],
  "IconDetached",
);
export const IconRent = makeIcon("0 0 21.5859 21", [P.keyShaft, P.keyRing], "IconRent");
export const IconPrecon = makeIcon(
  "0 0 22 20",
  [P.preconWindows, P.preconWing, P.preconTower],
  "IconPrecon",
);
export const IconSell = makeIcon("0 0 20 20", [P.chartAxis, P.chartLine], "IconSell");
/**
 * Condo / residential — Flaticon residential_10365223 (house + tall building).
 * https://www.flaticon.com/free-icon/residential_10365223
 */
export const IconCondo = makeIcon(
  "0 0 24 24",
  [
    "M1.5 11L6.5 6L11.5 11V20.5H1.5V11Z",
    "M5 20.5V15.5H8V20.5",
    "M4 13H5.25M7.75 13H9",
    "M12 9L17 3.5L22 9V20.5H12V9Z",
    "M15.5 20.5V15.5H18.5V20.5",
    "M14 11.5H15.25M16.75 11.5H18M14 14H15.25M16.75 14H18",
    "M1 20.5H23",
  ],
  "IconCondo",
);
/**
 * Townhomes — Flaticon house_16225234 (row of three gabled units).
 * https://www.flaticon.com/free-icon/house_16225234
 */
export const IconTownhome = makeIcon(
  "0 0 24 24",
  [
    "M1.5 10.5L5.5 5L9.5 10.5V20.5H1.5V10.5Z",
    "M9.5 10.5L12.5 5.5L15.5 10.5V20.5H9.5V10.5Z",
    "M15.5 10.5L19.5 5L22.5 10.5V20.5H15.5V10.5Z",
    "M4.5 20.5V15.5H6.5V20.5",
    "M11.5 20.5V15.5H13.5V20.5",
    "M18.5 20.5V15.5H20.5V20.5",
    "M3.5 12.5H5M6 12.5H7.5",
    "M11 12.5H12M13 12.5H14.5",
    "M17.5 12.5H19M20 12.5H21.5",
  ],
  "IconTownhome",
);
/** Two joined houses — Semi-Detached tile. */
export const IconSemi = makeIcon(
  "0 0 24 22",
  [
    "M1 10.5L6.5 5.5L12 10.5V20H1V10.5Z",
    "M12 10.5L17.5 5.5L23 10.5V20H12V10.5Z",
    "M5 20V14H8V20",
    "M16 20V14H19V20",
  ],
  "IconSemi",
);
export const IconLuxury = makeIcon(
  "0 0 22 21.0003",
  [P.gemFacets, P.gemOutline],
  "IconLuxury",
);
export const IconOpenHouse = makeIcon(
  "0 0 20 22",
  [P.calendarRings, P.calendarBody, P.calendarDays],
  "IconOpenHouse",
);
export const IconRental = makeIcon("0 0 22.0384 22.0384", [P.rentalKey], "IconRental");

/** Small arrow used on "Explore →" style affordances. */
export function IconArrowRight({ size = 18, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
      {...rest}
    >
      <path
        d="M3.75 9H14.25M9 3.75L14.25 9L9 14.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
