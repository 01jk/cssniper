import * as React from "react";
import knifeImg from "../../assets/knife.png";
import glovesImg from "../../assets/gloves.png";
import rifleImg from "../../assets/rifle.png";
import pistolsImg from "../../assets/pistols.png";
import smgImg from "../../assets/smg.png";

interface IconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number;
}

/**
 * NOTE: This file exists to guarantee the category popover uses the updated silhouettes
 * based on the user's reference screenshots, without touching the legacy icon file.
 */

// Karambit (CS2 reference screenshot): strong sickle curve + finger ring + grooved grip
export const KarambitIcon = React.forwardRef<HTMLImageElement, IconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <img
      ref={ref}
      src={knifeImg}
      alt="Knife"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      {...props}
    />
  ),
);
KarambitIcon.displayName = "KarambitIcon";

// Sport Gloves (reference screenshot): full gloves silhouette
export const SportGlovesIcon = React.forwardRef<HTMLImageElement, IconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <img
      ref={ref}
      src={glovesImg}
      alt="Gloves"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      {...props}
    />
  ),
);
SportGlovesIcon.displayName = "SportGlovesIcon";

// AK-47 (reference screenshot): distinct stock + receiver + banana mag
export const AK47Icon = React.forwardRef<HTMLImageElement, IconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <img
      ref={ref}
      src={rifleImg}
      alt="Rifles"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      {...props}
    />
  ),
);
AK47Icon.displayName = "AK47Icon";

// Desert Eagle (reference screenshot): long slide, blocky muzzle, big grip
export const DesertEagleIcon = React.forwardRef<HTMLImageElement, IconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <img
      ref={ref}
      src={pistolsImg}
      alt="Pistols"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      {...props}
    />
  ),
);
DesertEagleIcon.displayName = "DesertEagleIcon";

// UMP-45 (reference screenshot): long straight mag + vertical foregrip + folding stock
export const UMP45Icon = React.forwardRef<HTMLImageElement, IconProps>(
  ({ size = 24, className, ...props }, ref) => (
    <img
      ref={ref}
      src={smgImg}
      alt="SMGs"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
      {...props}
    />
  ),
);
UMP45Icon.displayName = "UMP45Icon";

// Re-export the rest from the legacy file
export {
  SawedOffIcon,
  NegevIcon,
  TitanStickerIcon,
  CS2CharmIcon,
  AgentDarrylIcon,
} from "./CS2CategoryIcons";
