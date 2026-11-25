import { SVGProps } from "react";
import knifeImg from "../../assets/knife.png";
import glovesImg from "../../assets/gloves.png";
import rifleImg from "../../assets/rifle.png";
import pistolsImg from "../../assets/pistols.png";
import smgImg from "../../assets/smg.png";
import shotgunsImg from "../../assets/shotguns.png";
import machinegunsImg from "../../assets/machineguns.png";
import stickersImg from "../../assets/stickers.png";
import charmsImg from "../../assets/charms.png";
import agentsImg from "../../assets/agents.png";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

// Karambit knife - based on CS2 reference: curved blade, ring, ergonomic grip
export const KarambitIcon = ({ size = 24, className }: IconProps) => (
  <img
    src={knifeImg}
    alt="Knife"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

// Sport Gloves - based on CS2 reference: full leather gloves with fingers
export const SportGlovesIcon = ({ size = 24, className }: IconProps) => (
  <img
    src={glovesImg}
    alt="Gloves"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

// AK-47 - based on CS2 reference: curved magazine, wooden furniture, gas tube
export const AK47Icon = ({ size = 24, className }: IconProps) => (
  <img
    src={rifleImg}
    alt="Rifles"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

// Desert Eagle - based on CS2 reference: massive barrel, triangular slide
export const DesertEagleIcon = ({ size = 24, className }: IconProps) => (
  <img
    src={pistolsImg}
    alt="Pistols"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

// UMP-45 - based on CS2 reference: folding stock, angled mag, top rail
export const UMP45Icon = ({ size = 24, className }: IconProps) => (
  <img
    src={smgImg}
    alt="SMGs"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

// Sawed-Off - обрез с двумя стволами
export const SawedOffIcon = ({ size = 24, className }: IconProps) => (
  <img
    src={shotgunsImg}
    alt="Shotguns"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

// Negev - тяжёлый пулемёт с коробчатым магазином
export const NegevIcon = ({ size = 24, className }: IconProps) => (
  <img
    src={machinegunsImg}
    alt="Machineguns"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

// Titan Katowice 2014 - буква T в рамке (логотип команды Titan)
export const TitanStickerIcon = ({ size = 24, className }: IconProps) => (
  <img
    src={stickersImg}
    alt="Stickers"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

// CS2 Charm - подвеска на карабине (стилизованный брелок)
export const CS2CharmIcon = ({ size = 24, className }: IconProps) => (
  <img
    src={charmsImg}
    alt="Charms"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

// Sir Bloody Miami Darryl - силуэт агента в костюме и маске
export const AgentDarrylIcon = ({ size = 24, className }: IconProps) => (
  <img
    src={agentsImg}
    alt="Agents"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);
