import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Copy, ChevronDown, ChevronUp, Hash, Sparkles, Tag, Layers, Eraser, Search, GripVertical, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterSection as FilterSectionType } from "@/components/targets/EditModeContext";
import { EXTRA_TOURNAMENT_COLLECTIONS, EXTRA_STICKERS } from "./ExtraStickersData";
import { useSoundSettings } from "@/contexts/SoundSettingsContext";


// Sticker tiers data - nested structure: Tier -> Tournament -> Type -> Stickers
const STICKER_TIERS_NESTED: Record<string, Record<string, Record<string, string[]>>> = {
  "Tier 1": {
    "Katowice 2014": {
      "Holo": [
        "Sticker | Titan (Holo) | Katowice 2014",
        "Sticker | iBUYPOWER (Holo) | Katowice 2014",
        "Sticker | Reason Gaming (Holo) | Katowice 2014",
        "Sticker | Vox Eminor (Holo) | Katowice 2014",
        "Sticker | Team Dignitas (Holo) | Katowice 2014",
        "Sticker | Team LDLC.com (Holo) | Katowice 2014",
        "Sticker | HellRaisers (Holo) | Katowice 2014",
        "Sticker | Natus Vincere (Holo) | Katowice 2014",
        "Sticker | Ninjas in Pyjamas (Holo) | Katowice 2014",
        "Sticker | Clan-Mystik (Holo) | Katowice 2014",
        "Sticker | Virtus.Pro (Holo) | Katowice 2014",
        "Sticker | mousesports (Holo) | Katowice 2014",
        "Sticker | LGB eSports (Holo) | Katowice 2014",
        "Sticker | 3DMAX (Holo) | Katowice 2014",
        "Sticker | compLexity Gaming (Holo) | Katowice 2014",
        "Sticker | Fnatic (Holo) | Katowice 2014"
      ],
      "Foil": [
        "Sticker | ESL Wolf (Foil) | Katowice 2014",
        "Sticker | ESL Skull (Foil) | Katowice 2014",
        "Sticker | Gold ESL Skull (Foil) | Katowice 2014",
        "Sticker | Gold ESL Wolf (Foil) | Katowice 2014",
        "Sticker | Vox Eminor (Foil) | Katowice 2014",
        "Sticker | Virtus.Pro (Foil) | Katowice 2014",
        "Sticker | Titan (Foil) | Katowice 2014",
        "Sticker | Reason Gaming (Foil) | Katowice 2014",
        "Sticker | Ninjas in Pyjamas (Foil) | Katowice 2014",
        "Sticker | Natus Vincere (Foil) | Katowice 2014",
        "Sticker | Clan-Mystik (Foil) | Katowice 2014",
        "Sticker | mousesports (Foil) | Katowice 2014",
        "Sticker | LGB eSports (Foil) | Katowice 2014",
        "Sticker | Team LDLC.com (Foil) | Katowice 2014",
        "Sticker | iBUYPOWER (Foil) | Katowice 2014",
        "Sticker | HellRaisers (Foil) | Katowice 2014",
        "Sticker | Fnatic (Foil) | Katowice 2014",
        "Sticker | Team Dignitas (Foil) | Katowice 2014",
        "Sticker | compLexity Gaming (Foil) | Katowice 2014",
        "Sticker | 3DMAX (Foil) | Katowice 2014"
      ],
      "Paper": [
        "Sticker | Reason Gaming | Katowice 2014",
        "Sticker | iBUYPOWER | Katowice 2014",
        "Sticker | Titan | Katowice 2014",
        "Sticker | Team LDLC.com | Katowice 2014",
        "Sticker | Team Dignitas | Katowice 2014",
        "Sticker | LGB eSports | Katowice 2014",
        "Sticker | Vox Eminor | Katowice 2014",
        "Sticker | 3DMAX | Katowice 2014",
        "Sticker | Clan-Mystik | Katowice 2014",
        "Sticker | Natus Vincere | Katowice 2014",
        "Sticker | mousesports | Katowice 2014",
        "Sticker | HellRaisers | Katowice 2014",
        "Sticker | compLexity Gaming | Katowice 2014",
        "Sticker | Virtus.Pro | Katowice 2014",
        "Sticker | Ninjas in Pyjamas | Katowice 2014",
        "Sticker | Fnatic | Katowice 2014"
      ]
    },
    "Exclusive": {
      "Special": [
        "Sticker | Harp of War",
        "Sticker | King on the Field",
        "Sticker | Howling Dawn",
        "Sticker | Crown (Foil)",
        "Sticker | Winged Defuser",
        "Sticker | Swag (Foil)",
        "Sticker | Flammable (Foil)"
      ]
    }
  },
  "Tier 2": {
    "Katowice 2015": {
      "Holo": [
        "Sticker | Vox Eminor (Holo) | Katowice 2015",
        "Sticker | Titan (Holo) | Katowice 2015",
        "Sticker | Natus Vincere (Holo) | Katowice 2015",
        "Sticker | Flipsid3 Tactics (Holo) | Katowice 2015",
        "Sticker | LGB eSports (Holo) | Katowice 2015",
        "Sticker | Counter Logic Gaming (Holo) | Katowice 2015",
        "Sticker | Cloud9 G2A (Holo) | Katowice 2015",
        "Sticker | Keyd Stars (Holo) | Katowice 2015",
        "Sticker | Virtus.pro (Holo) | Katowice 2015",
        "Sticker | 3DMAX (Holo) | Katowice 2015",
        "Sticker | HellRaisers (Holo) | Katowice 2015",
        "Sticker | Fnatic (Holo) | Katowice 2015",
        "Sticker | Ninjas in Pyjamas (Holo) | Katowice 2015",
        "Sticker | Team EnVyUs (Holo) | Katowice 2015",
        "Sticker | PENTA Sports (Holo) | Katowice 2015",
        "Sticker | TSM Kinguin (Holo) | Katowice 2015"
      ],
      "Foil": [
        "Sticker | LGB eSports (Foil) | Katowice 2015",
        "Sticker | Titan (Foil) | Katowice 2015",
        "Sticker | Vox Eminor (Foil) | Katowice 2015",
        "Sticker | 3DMAX (Foil) | Katowice 2015",
        "Sticker | HellRaisers (Foil) | Katowice 2015",
        "Sticker | Counter Logic Gaming (Foil) | Katowice 2015",
        "Sticker | Cloud9 G2A (Foil) | Katowice 2015",
        "Sticker | Keyd Stars (Foil) | Katowice 2015",
        "Sticker | Flipsid3 Tactics (Foil) | Katowice 2015",
        "Sticker | Fnatic (Foil) | Katowice 2015",
        "Sticker | Natus Vincere (Foil) | Katowice 2015",
        "Sticker | Virtus.pro (Foil) | Katowice 2015",
        "Sticker | Team EnVyUs (Foil) | Katowice 2015",
        "Sticker | Ninjas in Pyjamas (Foil) | Katowice 2015",
        "Sticker | PENTA Sports (Foil) | Katowice 2015",
        "Sticker | TSM Kinguin (Foil) | Katowice 2015",
        "Sticker | ESL One (Foil) | Katowice 2015"
      ],
      "Paper": [
        "Sticker | LGB eSports | Katowice 2015",
        "Sticker | 3DMAX | Katowice 2015",
        "Sticker | Titan | Katowice 2015",
        "Sticker | Vox Eminor | Katowice 2015",
        "Sticker | HellRaisers | Katowice 2015",
        "Sticker | Keyd Stars | Katowice 2015",
        "Sticker | Flipsid3 Tactics | Katowice 2015",
        "Sticker | Cloud9 G2A | Katowice 2015",
        "Sticker | Counter Logic Gaming | Katowice 2015",
        "Sticker | Natus Vincere | Katowice 2015",
        "Sticker | Virtus.pro | Katowice 2015",
        "Sticker | Fnatic | Katowice 2015",
        "Sticker | Team EnVyUs | Katowice 2015",
        "Sticker | PENTA Sports | Katowice 2015",
        "Sticker | Ninjas in Pyjamas | Katowice 2015",
        "Sticker | TSM Kinguin | Katowice 2015",
        "Sticker | ESL One | Katowice 2015"
      ],
      "Gold": [
        "Sticker | Vox Eminor (Gold) | Katowice 2015",
        "Sticker | Virtus.pro (Gold) | Katowice 2015",
        "Sticker | Titan (Gold) | Katowice 2015",
        "Sticker | TSM Kinguin (Gold) | Katowice 2015",
        "Sticker | Team EnVyUs (Gold) | Katowice 2015",
        "Sticker | PENTA Sports (Gold) | Katowice 2015",
        "Sticker | Ninjas in Pyjamas (Gold) | Katowice 2015",
        "Sticker | Natus Vincere (Gold) | Katowice 2015",
        "Sticker | LGB eSports (Gold) | Katowice 2015",
        "Sticker | Keyd Stars (Gold) | Katowice 2015",
        "Sticker | HellRaisers (Gold) | Katowice 2015",
        "Sticker | Fnatic (Gold) | Katowice 2015",
        "Sticker | Flipsid3 Tactics (Gold) | Katowice 2015",
        "Sticker | ESL One (Gold) | Katowice 2015",
        "Sticker | Counter Logic Gaming (Gold) | Katowice 2015",
        "Sticker | Cloud9 G2A (Gold) | Katowice 2015",
        "Sticker | 3DMAX (Gold) | Katowice 2015"
      ]
    },
    "DreamHack 2014": {
      "Holo": [
        "Sticker | Team Dignitas (Holo) | DreamHack 2014",
        "Sticker | Cloud9 (Holo) | DreamHack 2014",
        "Sticker | Natus Vincere (Holo) | DreamHack 2014",
        "Sticker | Fnatic (Holo) | DreamHack 2014",
        "Sticker | Virtus.Pro (Holo) | DreamHack 2014",
        "Sticker | Ninjas in Pyjamas (Holo) | DreamHack 2014"
      ],
      "Foil": [
        "Sticker | Team Dignitas (Foil) | DreamHack 2014",
        "Sticker | Cloud9 (Foil) | DreamHack 2014",
        "Sticker | Natus Vincere (Foil) | DreamHack 2014",
        "Sticker | Ninjas in Pyjamas (Foil) | DreamHack 2014",
        "Sticker | Fnatic (Foil) | DreamHack 2014",
        "Sticker | Virtus.Pro (Foil) | DreamHack 2014"
      ],
      "Paper": [
        "Sticker | iBUYPOWER | DreamHack 2014",
        "Sticker | Planetkey Dynamics | DreamHack 2014",
        "Sticker | Flipsid3 Tactics | DreamHack 2014",
        "Sticker | Team Dignitas | DreamHack 2014",
        "Sticker | HellRaisers | DreamHack 2014",
        "Sticker | Bravado Gaming | DreamHack 2014",
        "Sticker | Copenhagen Wolves | DreamHack 2014",
        "Sticker | Cloud9 | DreamHack 2014",
        "Sticker | Team LDLC.com | DreamHack 2014",
        "Sticker | myXMG | DreamHack 2014",
        "Sticker | ESC Gaming | DreamHack 2014",
        "Sticker | Natus Vincere | DreamHack 2014",
        "Sticker | PENTA Sports | DreamHack 2014",
        "Sticker | Fnatic | DreamHack 2014",
        "Sticker | Virtus.Pro | DreamHack 2014",
        "Sticker | Ninjas in Pyjamas | DreamHack 2014",
        "Sticker | mousesports | DreamHack 2014",
        "Sticker | London Conspiracy | DreamHack 2014",
        "Sticker | dAT team | DreamHack 2014",
        "Sticker | 3DMAX | DreamHack 2014"
      ],
      "Gold": [
        "Sticker | Flipsid3 Tactics (Gold) | DreamHack 2014",
        "Sticker | Virtus.Pro (Gold) | DreamHack 2014",
        "Sticker | Team LDLC.com (Gold) | DreamHack 2014",
        "Sticker | Planetkey Dynamics (Gold) | DreamHack 2014",
        "Sticker | PENTA Sports (Gold) | DreamHack 2014",
        "Sticker | Ninjas in Pyjamas (Gold) | DreamHack 2014",
        "Sticker | Natus Vincere (Gold) | DreamHack 2014",
        "Sticker | myXMG (Gold) | DreamHack 2014",
        "Sticker | mousesports (Gold) | DreamHack 2014",
        "Sticker | London Conspiracy (Gold) | DreamHack 2014",
        "Sticker | iBUYPOWER (Gold) | DreamHack 2014",
        "Sticker | HellRaisers (Gold) | DreamHack 2014",
        "Sticker | Fnatic (Gold) | DreamHack 2014",
        "Sticker | ESC Gaming (Gold) | DreamHack 2014",
        "Sticker | dAT team (Gold) | DreamHack 2014",
        "Sticker | Copenhagen Wolves (Gold) | DreamHack 2014",
        "Sticker | Cloud9 (Gold) | DreamHack 2014",
        "Sticker | Bravado Gaming (Gold) | DreamHack 2014",
        "Sticker | 3DMAX (Gold) | DreamHack 2014"
      ]
    },
    "Cologne 2014": {
      "Holo": [
        "Sticker | Team Dignitas (Holo) | Cologne 2014",
        "Sticker | iBUYPOWER (Holo) | Cologne 2014",
        "Sticker | Titan (Holo) | Cologne 2014",
        "Sticker | Team LDLC.com (Holo) | Cologne 2014",
        "Sticker | dAT team (Holo) | Cologne 2014",
        "Sticker | Vox Eminor (Holo) | Cologne 2014",
        "Sticker | London Conspiracy (Holo) | Cologne 2014",
        "Sticker | Cloud9 (Holo) | Cologne 2014",
        "Sticker | Natus Vincere (Holo) | Cologne 2014",
        "Sticker | Copenhagen Wolves (Holo) | Cologne 2014",
        "Sticker | Epsilon eSports (Holo) | Cologne 2014",
        "Sticker | HellRaisers (Holo) | Cologne 2014",
        "Sticker | MTS GameGod Wolf (Holo) | Cologne 2014",
        "Sticker | Ninjas in Pyjamas (Holo) | Cologne 2014",
        "Sticker | Virtus.Pro (Holo) | Cologne 2014",
        "Sticker | Fnatic (Holo) | Cologne 2014"
      ],
      "Foil": [
        "Sticker | MTS GameGod Wolf (Foil) | Cologne 2014",
        "Sticker | Vox Eminor (Foil) | Cologne 2014",
        "Sticker | Titan (Foil) | Cologne 2014",
        "Sticker | Natus Vincere (Foil) | Cologne 2014",
        "Sticker | London Conspiracy (Foil) | Cologne 2014",
        "Sticker | iBUYPOWER (Foil) | Cologne 2014",
        "Sticker | Epsilon eSports (Foil) | Cologne 2014",
        "Sticker | dAT team (Foil) | Cologne 2014",
        "Sticker | Copenhagen Wolves (Foil) | Cologne 2014",
        "Sticker | Virtus.Pro (Foil) | Cologne 2014",
        "Sticker | Team LDLC.com (Foil) | Cologne 2014",
        "Sticker | Team Dignitas (Foil) | Cologne 2014",
        "Sticker | Ninjas in Pyjamas (Foil) | Cologne 2014",
        "Sticker | HellRaisers (Foil) | Cologne 2014",
        "Sticker | Fnatic (Foil) | Cologne 2014",
        "Sticker | Cloud9 (Foil) | Cologne 2014"
      ],
      "Paper": [
        "Sticker | iBUYPOWER | Cologne 2014",
        "Sticker | Team Dignitas | Cologne 2014",
        "Sticker | Titan | Cologne 2014",
        "Sticker | Vox Eminor | Cologne 2014",
        "Sticker | London Conspiracy | Cologne 2014",
        "Sticker | Team LDLC.com | Cologne 2014",
        "Sticker | Cloud9 | Cologne 2014",
        "Sticker | Natus Vincere | Cologne 2014",
        "Sticker | HellRaisers | Cologne 2014",
        "Sticker | Epsilon eSports | Cologne 2014",
        "Sticker | Ninjas in Pyjamas | Cologne 2014",
        "Sticker | Copenhagen Wolves | Cologne 2014",
        "Sticker | Virtus.Pro | Cologne 2014",
        "Sticker | Fnatic | Cologne 2014",
        "Sticker | dAT team | Cologne 2014",
        "Sticker | MTS GameGod Wolf | Cologne 2014"
      ]
    }
  },
  "Tier 3": {
    "Boston 2018": {
      "Holo": [
        "Sticker | 100 Thieves (Holo) | Boston 2018",
        "Sticker | Tyloo (Holo) | Boston 2018",
        "Sticker | Cloud9 (Holo) | Boston 2018",
        "Sticker | Flash Gaming (Holo) | Boston 2018",
        "Sticker | FaZe Clan (Holo) | Boston 2018",
        "Sticker | Team Liquid (Holo) | Boston 2018",
        "Sticker | Astralis (Holo) | Boston 2018",
        "Sticker | mousesports (Holo) | Boston 2018",
        "Sticker | Flipsid3 Tactics (Holo) | Boston 2018",
        "Sticker | Avangar (Holo) | Boston 2018",
        "Sticker | SK Gaming (Holo) | Boston 2018",
        "Sticker | Team EnVyUs (Holo) | Boston 2018",
        "Sticker | Virtus.Pro (Holo) | Boston 2018",
        "Sticker | Vega Squadron (Holo) | Boston 2018",
        "Sticker | North (Holo) | Boston 2018",
        "Sticker | Natus Vincere (Holo) | Boston 2018",
        "Sticker | Gambit Esports (Holo) | Boston 2018",
        "Sticker | Sprout Esports (Holo) | Boston 2018",
        "Sticker | Fnatic (Holo) | Boston 2018",
        "Sticker | Quantum Bellator Fire (Holo) | Boston 2018",
        "Sticker | Space Soldiers (Holo) | Boston 2018",
        "Sticker | Misfits Gaming (Holo) | Boston 2018",
        "Sticker | G2 Esports (Holo) | Boston 2018",
        "Sticker | Renegades (Holo) | Boston 2018",
        "Sticker | BIG (Holo) | Boston 2018",
        "Sticker | ELEAGUE (Holo) | Boston 2018"
      ],
      "Foil": [
        "Sticker | 100 Thieves (Foil) | Boston 2018",
        "Sticker | Tyloo (Foil) | Boston 2018",
        "Sticker | seang@res (Foil) | Boston 2018",
        "Sticker | Cloud9 (Foil) | Boston 2018",
        "Sticker | Twistzz (Foil) | Boston 2018",
        "Sticker | ScreaM (Foil) | Boston 2018",
        "Sticker | somebody (Foil) | Boston 2018",
        "Sticker | captainMo (Foil) | Boston 2018",
        "Sticker | FaZe Clan (Foil) | Boston 2018",
        "Sticker | DD (Foil) | Boston 2018",
        "Sticker | Flash Gaming (Foil) | Boston 2018",
        "Sticker | Team Liquid (Foil) | Boston 2018",
        "Sticker | NiKo (Foil) | Boston 2018",
        "Sticker | LUCAS1 (Foil) | Boston 2018",
        "Sticker | Sprout Esports (Foil) | Boston 2018",
        "Sticker | Astralis (Foil) | Boston 2018",
        "Sticker | mousesports (Foil) | Boston 2018",
        "Sticker | Flipsid3 Tactics (Foil) | Boston 2018",
        "Sticker | Avangar (Foil) | Boston 2018",
        "Sticker | fnx (Foil) | Boston 2018",
        "Sticker | North (Foil) | Boston 2018",
        "Sticker | SK Gaming (Foil) | Boston 2018",
        "Sticker | jks (Foil) | Boston 2018",
        "Sticker | s1mple (Foil) | Boston 2018",
        "Sticker | EliGE (Foil) | Boston 2018",
        "Sticker | device (Foil) | Boston 2018",
        "Sticker | kNgV- (Foil) | Boston 2018",
        "Sticker | HEN1 (Foil) | Boston 2018",
        "Sticker | Summer (Foil) | Boston 2018",
        "Sticker | ropz (Foil) | Boston 2018",
        "Sticker | Lekr0 (Foil) | Boston 2018",
        "Sticker | Team EnVyUs (Foil) | Boston 2018",
        "Sticker | kennyS (Foil) | Boston 2018",
        "Sticker | Happy (Foil) | Boston 2018",
        "Sticker | Stewie2K (Foil) | Boston 2018",
        "Sticker | BnTeT (Foil) | Boston 2018",
        "Sticker | keshandr (Foil) | Boston 2018",
        "Sticker | rain (Foil) | Boston 2018",
        "Sticker | Vega Squadron (Foil) | Boston 2018",
        "Sticker | Jame (Foil) | Boston 2018",
        "Sticker | Virtus.Pro (Foil) | Boston 2018",
        "Sticker | Space Soldiers (Foil) | Boston 2018",
        "Sticker | LoveYY (Foil) | Boston 2018",
        "Sticker | Fnatic (Foil) | Boston 2018",
        "Sticker | Skadoodle (Foil) | Boston 2018",
        "Sticker | Attacker (Foil) | Boston 2018",
        "Sticker | Renegades (Foil) | Boston 2018",
        "Sticker | Natus Vincere (Foil) | Boston 2018",
        "Sticker | bondik (Foil) | Boston 2018",
        "Sticker | Karsa (Foil) | Boston 2018",
        "Sticker | XANTARES (Foil) | Boston 2018",
        "Sticker | Misfits Gaming (Foil) | Boston 2018",
        "Sticker | karrigan (Foil) | Boston 2018",
        "Sticker | G2 Esports (Foil) | Boston 2018",
        "Sticker | MSL (Foil) | Boston 2018",
        "Sticker | Quantum Bellator Fire (Foil) | Boston 2018",
        "Sticker | Gambit Esports (Foil) | Boston 2018",
        "Sticker | SIXER (Foil) | Boston 2018",
        "Sticker | FalleN (Foil) | Boston 2018",
        "Sticker | jdm64 (Foil) | Boston 2018",
        "Sticker | BIT (Foil) | Boston 2018",
        "Sticker | dimasick (Foil) | Boston 2018",
        "Sticker | BIG (Foil) | Boston 2018",
        "Sticker | Kaze (Foil) | Boston 2018",
        "Sticker | GuardiaN (Foil) | Boston 2018",
        "Sticker | nitr0 (Foil) | Boston 2018",
        "Sticker | xms (Foil) | Boston 2018",
        "Sticker | RUSH (Foil) | Boston 2018",
        "Sticker | autimatic (Foil) | Boston 2018",
        "Sticker | RpK (Foil) | Boston 2018",
        "Sticker | Boombl4 (Foil) | Boston 2018",
        "Sticker | k0nfig (Foil) | Boston 2018",
        "Sticker | olofmeister (Foil) | Boston 2018",
        "Sticker | flusha (Foil) | Boston 2018",
        "Sticker | tarik (Foil) | Boston 2018",
        "Sticker | Nifty (Foil) | Boston 2018",
        "Sticker | NAF (Foil) | Boston 2018",
        "Sticker | pashaBiceps (Foil) | Boston 2018",
        "Sticker | dupreeh (Foil) | Boston 2018",
        "Sticker | ELEAGUE (Foil) | Boston 2018",
        "Sticker | B1ad3 (Foil) | Boston 2018",
        "Sticker | devoduvek (Foil) | Boston 2018",
        "Sticker | markeloff (Foil) | Boston 2018",
        "Sticker | USTILO (Foil) | Boston 2018",
        "Sticker | stanislaw (Foil) | Boston 2018",
        "Sticker | jR (Foil) | Boston 2018",
        "Sticker | cajunb (Foil) | Boston 2018",
        "Sticker | aizy (Foil) | Boston 2018",
        "Sticker | chopper (Foil) | Boston 2018",
        "Sticker | v4lde (Foil) | Boston 2018",
        "Sticker | denis (Foil) | Boston 2018",
        "Sticker | suNny (Foil) | Boston 2018",
        "Sticker | coldzera (Foil) | Boston 2018",
        "Sticker | MAJ3R (Foil) | Boston 2018",
        "Sticker | jmqa (Foil) | Boston 2018",
        "Sticker | Golden (Foil) | Boston 2018",
        "Sticker | shox (Foil) | Boston 2018",
        "Sticker | mou (Foil) | Boston 2018",
        "Sticker | hutji (Foil) | Boston 2018",
        "Sticker | electronic (Foil) | Boston 2018",
        "Sticker | apEX (Foil) | Boston 2018",
        "Sticker | Kvik (Foil) | Boston 2018",
        "Sticker | KrizzeN (Foil) | Boston 2018",
        "Sticker | JW (Foil) | Boston 2018",
        "Sticker | keev (Foil) | Boston 2018",
        "Sticker | AmaNEk (Foil) | Boston 2018",
        "Sticker | fer (Foil) | Boston 2018",
        "Sticker | seized (Foil) | Boston 2018",
        "Sticker | WorldEdit (Foil) | Boston 2018",
        "Sticker | wayLander (Foil) | Boston 2018",
        "Sticker | chrisJ (Foil) | Boston 2018",
        "Sticker | paz (Foil) | Boston 2018",
        "Sticker | Xyp9x (Foil) | Boston 2018",
        "Sticker | balblna (Foil) | Boston 2018",
        "Sticker | NEO (Foil) | Boston 2018",
        "Sticker | SicK (Foil) | Boston 2018",
        "Sticker | kRYSTAL (Foil) | Boston 2018",
        "Sticker | Kjaerbye (Foil) | Boston 2018",
        "Sticker | qikert (Foil) | Boston 2018",
        "Sticker | ngiN (Foil) | Boston 2018",
        "Sticker | mir (Foil) | Boston 2018",
        "Sticker | AZR (Foil) | Boston 2018",
        "Sticker | Spiidi (Foil) | Boston 2018",
        "Sticker | gla1ve (Foil) | Boston 2018",
        "Sticker | STYKO (Foil) | Boston 2018",
        "Sticker | innocent (Foil) | Boston 2018",
        "Sticker | Calyx (Foil) | Boston 2018",
        "Sticker | waterfaLLZ (Foil) | Boston 2018",
        "Sticker | Snax (Foil) | Boston 2018",
        "Sticker | nex (Foil) | Boston 2018",
        "Sticker | buster (Foil) | Boston 2018",
        "Sticker | Dosia (Foil) | Boston 2018",
        "Sticker | NBK- (Foil) | Boston 2018",
        "Sticker | felps (Foil) | Boston 2018",
        "Sticker | ShahZaM (Foil) | Boston 2018",
        "Sticker | zehN (Foil) | Boston 2018",
        "Sticker | oskar (Foil) | Boston 2018",
        "Sticker | TACO (Foil) | Boston 2018",
        "Sticker | Hobbit (Foil) | Boston 2018",
        "Sticker | byali (Foil) | Boston 2018",
        "Sticker | bodyy (Foil) | Boston 2018",
        "Sticker | Zeus (Foil) | Boston 2018",
        "Sticker | gob b (Foil) | Boston 2018",
        "Sticker | fitch (Foil) | Boston 2018",
        "Sticker | flamie (Foil) | Boston 2018",
        "Sticker | Edward (Foil) | Boston 2018",
        "Sticker | LEGIJA (Foil) | Boston 2018",
        "Sticker | AdreN (Foil) | Boston 2018",
        "Sticker | tabseN (Foil) | Boston 2018",
        "Sticker | KRIMZ (Foil) | Boston 2018",
        "Sticker | TaZ (Foil) | Boston 2018"
      ],
      "Paper": [
        "Sticker | seang@res | Boston 2018",
        "Sticker | 100 Thieves | Boston 2018",
        "Sticker | ScreaM | Boston 2018",
        "Sticker | captainMo | Boston 2018",
        "Sticker | DD | Boston 2018",
        "Sticker | Twistzz | Boston 2018",
        "Sticker | somebody | Boston 2018",
        "Sticker | fnx | Boston 2018",
        "Sticker | NiKo | Boston 2018",
        "Sticker | LUCAS1 | Boston 2018",
        "Sticker | BIT | Boston 2018",
        "Sticker | device | Boston 2018",
        "Sticker | Flipsid3 Tactics | Boston 2018",
        "Sticker | s1mple | Boston 2018",
        "Sticker | HEN1 | Boston 2018",
        "Sticker | LoveYY | Boston 2018",
        "Sticker | Sprout Esports | Boston 2018",
        "Sticker | kNgV- | Boston 2018",
        "Sticker | jks | Boston 2018",
        "Sticker | XANTARES | Boston 2018",
        "Sticker | kennyS | Boston 2018",
        "Sticker | Team Liquid | Boston 2018",
        "Sticker | dimasick | Boston 2018",
        "Sticker | Stewie2K | Boston 2018",
        "Sticker | ropz | Boston 2018",
        "Sticker | mousesports | Boston 2018",
        "Sticker | Summer | Boston 2018",
        "Sticker | BnTeT | Boston 2018",
        "Sticker | pashaBiceps | Boston 2018",
        "Sticker | Attacker | Boston 2018",
        "Sticker | Avangar | Boston 2018",
        "Sticker | Tyloo | Boston 2018",
        "Sticker | EliGE | Boston 2018",
        "Sticker | Happy | Boston 2018",
        "Sticker | keshandr | Boston 2018",
        "Sticker | bondik | Boston 2018",
        "Sticker | MSL | Boston 2018",
        "Sticker | rain | Boston 2018",
        "Sticker | Team EnVyUs | Boston 2018",
        "Sticker | FalleN | Boston 2018",
        "Sticker | Jame | Boston 2018",
        "Sticker | SIXER | Boston 2018",
        "Sticker | Astralis | Boston 2018",
        "Sticker | Skadoodle | Boston 2018",
        "Sticker | Kaze | Boston 2018",
        "Sticker | Karsa | Boston 2018",
        "Sticker | RUSH | Boston 2018",
        "Sticker | flusha | Boston 2018",
        "Sticker | USTILO | Boston 2018",
        "Sticker | Flash Gaming | Boston 2018",
        "Sticker | fer | Boston 2018",
        "Sticker | FaZe Clan | Boston 2018",
        "Sticker | Cloud9 | Boston 2018",
        "Sticker | SK Gaming | Boston 2018",
        "Sticker | Vega Squadron | Boston 2018",
        "Sticker | karrigan | Boston 2018",
        "Sticker | MAJ3R | Boston 2018",
        "Sticker | markeloff | Boston 2018",
        "Sticker | mou | Boston 2018",
        "Sticker | Virtus.Pro | Boston 2018",
        "Sticker | xms | Boston 2018",
        "Sticker | Misfits Gaming | Boston 2018",
        "Sticker | ngiN | Boston 2018",
        "Sticker | paz | Boston 2018",
        "Sticker | North | Boston 2018",
        "Sticker | k0nfig | Boston 2018",
        "Sticker | Natus Vincere | Boston 2018",
        "Sticker | RpK | Boston 2018",
        "Sticker | tarik | Boston 2018",
        "Sticker | B1ad3 | Boston 2018",
        "Sticker | NAF | Boston 2018",
        "Sticker | GuardiaN | Boston 2018",
        "Sticker | balblna | Boston 2018",
        "Sticker | jdm64 | Boston 2018",
        "Sticker | Dosia | Boston 2018",
        "Sticker | Space Soldiers | Boston 2018",
        "Sticker | Fnatic | Boston 2018",
        "Sticker | olofmeister | Boston 2018",
        "Sticker | Nifty | Boston 2018",
        "Sticker | Boombl4 | Boston 2018",
        "Sticker | WorldEdit | Boston 2018",
        "Sticker | Snax | Boston 2018",
        "Sticker | stanislaw | Boston 2018",
        "Sticker | denis | Boston 2018",
        "Sticker | coldzera | Boston 2018",
        "Sticker | JW | Boston 2018",
        "Sticker | SicK | Boston 2018",
        "Sticker | Lekr0 | Boston 2018",
        "Sticker | dupreeh | Boston 2018",
        "Sticker | seized | Boston 2018",
        "Sticker | v4lde | Boston 2018",
        "Sticker | autimatic | Boston 2018",
        "Sticker | Xyp9x | Boston 2018",
        "Sticker | jR | Boston 2018",
        "Sticker | nex | Boston 2018",
        "Sticker | KrizzeN | Boston 2018",
        "Sticker | Spiidi | Boston 2018",
        "Sticker | electronic | Boston 2018",
        "Sticker | AZR | Boston 2018",
        "Sticker | kRYSTAL | Boston 2018",
        "Sticker | chopper | Boston 2018",
        "Sticker | cajunb | Boston 2018",
        "Sticker | NEO | Boston 2018",
        "Sticker | keev | Boston 2018",
        "Sticker | wayLander | Boston 2018",
        "Sticker | waterfaLLZ | Boston 2018",
        "Sticker | AmaNEk | Boston 2018",
        "Sticker | shox | Boston 2018",
        "Sticker | jmqa | Boston 2018",
        "Sticker | G2 Esports | Boston 2018",
        "Sticker | byali | Boston 2018",
        "Sticker | buster | Boston 2018",
        "Sticker | TACO | Boston 2018",
        "Sticker | qikert | Boston 2018",
        "Sticker | zehN | Boston 2018",
        "Sticker | suNny | Boston 2018",
        "Sticker | Calyx | Boston 2018",
        "Sticker | Hobbit | Boston 2018",
        "Sticker | BIG | Boston 2018",
        "Sticker | oskar | Boston 2018",
        "Sticker | nitr0 | Boston 2018",
        "Sticker | devoduvek | Boston 2018",
        "Sticker | Gambit Esports | Boston 2018",
        "Sticker | innocent | Boston 2018",
        "Sticker | ShahZaM | Boston 2018",
        "Sticker | mir | Boston 2018",
        "Sticker | Golden | Boston 2018",
        "Sticker | apEX | Boston 2018",
        "Sticker | Kvik | Boston 2018",
        "Sticker | Renegades | Boston 2018",
        "Sticker | gla1ve | Boston 2018",
        "Sticker | chrisJ | Boston 2018",
        "Sticker | TaZ | Boston 2018",
        "Sticker | AdreN | Boston 2018",
        "Sticker | Zeus | Boston 2018",
        "Sticker | Quantum Bellator Fire | Boston 2018",
        "Sticker | aizy | Boston 2018",
        "Sticker | NBK- | Boston 2018",
        "Sticker | hutji | Boston 2018",
        "Sticker | gob b | Boston 2018",
        "Sticker | Kjaerbye | Boston 2018",
        "Sticker | fitch | Boston 2018",
        "Sticker | flamie | Boston 2018",
        "Sticker | STYKO | Boston 2018",
        "Sticker | felps | Boston 2018",
        "Sticker | ELEAGUE | Boston 2018",
        "Sticker | Edward | Boston 2018",
        "Sticker | KRIMZ | Boston 2018",
        "Sticker | tabseN | Boston 2018",
        "Sticker | LEGIJA | Boston 2018",
        "Sticker | bodyy | Boston 2018"
      ],
      "Gold": [
        "Sticker | bondik (Gold) | Boston 2018",
        "Sticker | Happy (Gold) | Boston 2018",
        "Sticker | captainMo (Gold) | Boston 2018",
        "Sticker | LUCAS1 (Gold) | Boston 2018",
        "Sticker | seang@res (Gold) | Boston 2018",
        "Sticker | DD (Gold) | Boston 2018",
        "Sticker | ShahZaM (Gold) | Boston 2018",
        "Sticker | kNgV- (Gold) | Boston 2018",
        "Sticker | HEN1 (Gold) | Boston 2018",
        "Sticker | BIT (Gold) | Boston 2018",
        "Sticker | somebody (Gold) | Boston 2018",
        "Sticker | Lekr0 (Gold) | Boston 2018",
        "Sticker | fnx (Gold) | Boston 2018",
        "Sticker | Twistzz (Gold) | Boston 2018",
        "Sticker | NiKo (Gold) | Boston 2018",
        "Sticker | waterfaLLZ (Gold) | Boston 2018",
        "Sticker | ropz (Gold) | Boston 2018",
        "Sticker | s1mple (Gold) | Boston 2018",
        "Sticker | kennyS (Gold) | Boston 2018",
        "Sticker | EliGE (Gold) | Boston 2018",
        "Sticker | BnTeT (Gold) | Boston 2018",
        "Sticker | Summer (Gold) | Boston 2018",
        "Sticker | Nifty (Gold) | Boston 2018",
        "Sticker | jks (Gold) | Boston 2018",
        "Sticker | XANTARES (Gold) | Boston 2018",
        "Sticker | keshandr (Gold) | Boston 2018",
        "Sticker | Golden (Gold) | Boston 2018",
        "Sticker | rain (Gold) | Boston 2018",
        "Sticker | Skadoodle (Gold) | Boston 2018",
        "Sticker | device (Gold) | Boston 2018",
        "Sticker | NAF (Gold) | Boston 2018",
        "Sticker | Stewie2K (Gold) | Boston 2018",
        "Sticker | electronic (Gold) | Boston 2018",
        "Sticker | nitr0 (Gold) | Boston 2018",
        "Sticker | ScreaM (Gold) | Boston 2018",
        "Sticker | MAJ3R (Gold) | Boston 2018",
        "Sticker | fer (Gold) | Boston 2018",
        "Sticker | GuardiaN (Gold) | Boston 2018",
        "Sticker | LoveYY (Gold) | Boston 2018",
        "Sticker | Boombl4 (Gold) | Boston 2018",
        "Sticker | JW (Gold) | Boston 2018",
        "Sticker | flusha (Gold) | Boston 2018",
        "Sticker | Jame (Gold) | Boston 2018",
        "Sticker | FalleN (Gold) | Boston 2018",
        "Sticker | jdm64 (Gold) | Boston 2018",
        "Sticker | RUSH (Gold) | Boston 2018",
        "Sticker | Calyx (Gold) | Boston 2018",
        "Sticker | coldzera (Gold) | Boston 2018",
        "Sticker | pashaBiceps (Gold) | Boston 2018",
        "Sticker | tarik (Gold) | Boston 2018",
        "Sticker | Spiidi (Gold) | Boston 2018",
        "Sticker | RpK (Gold) | Boston 2018",
        "Sticker | keev (Gold) | Boston 2018",
        "Sticker | suNny (Gold) | Boston 2018",
        "Sticker | karrigan (Gold) | Boston 2018",
        "Sticker | dupreeh (Gold) | Boston 2018",
        "Sticker | shox (Gold) | Boston 2018",
        "Sticker | Kjaerbye (Gold) | Boston 2018",
        "Sticker | olofmeister (Gold) | Boston 2018",
        "Sticker | Karsa (Gold) | Boston 2018",
        "Sticker | Kaze (Gold) | Boston 2018",
        "Sticker | apEX (Gold) | Boston 2018",
        "Sticker | Attacker (Gold) | Boston 2018",
        "Sticker | NEO (Gold) | Boston 2018",
        "Sticker | Snax (Gold) | Boston 2018",
        "Sticker | jmqa (Gold) | Boston 2018",
        "Sticker | bodyy (Gold) | Boston 2018",
        "Sticker | seized (Gold) | Boston 2018",
        "Sticker | nex (Gold) | Boston 2018",
        "Sticker | MSL (Gold) | Boston 2018",
        "Sticker | balblna (Gold) | Boston 2018",
        "Sticker | Xyp9x (Gold) | Boston 2018",
        "Sticker | USTILO (Gold) | Boston 2018",
        "Sticker | Hobbit (Gold) | Boston 2018",
        "Sticker | ngiN (Gold) | Boston 2018",
        "Sticker | devoduvek (Gold) | Boston 2018",
        "Sticker | AmaNEk (Gold) | Boston 2018",
        "Sticker | LEGIJA (Gold) | Boston 2018",
        "Sticker | byali (Gold) | Boston 2018",
        "Sticker | autimatic (Gold) | Boston 2018",
        "Sticker | mou (Gold) | Boston 2018",
        "Sticker | B1ad3 (Gold) | Boston 2018",
        "Sticker | jR (Gold) | Boston 2018",
        "Sticker | tabseN (Gold) | Boston 2018",
        "Sticker | chrisJ (Gold) | Boston 2018",
        "Sticker | Edward (Gold) | Boston 2018",
        "Sticker | Kvik (Gold) | Boston 2018",
        "Sticker | markeloff (Gold) | Boston 2018",
        "Sticker | TACO (Gold) | Boston 2018",
        "Sticker | KrizzeN (Gold) | Boston 2018",
        "Sticker | AZR (Gold) | Boston 2018",
        "Sticker | SicK (Gold) | Boston 2018",
        "Sticker | Zeus (Gold) | Boston 2018",
        "Sticker | cajunb (Gold) | Boston 2018",
        "Sticker | Dosia (Gold) | Boston 2018",
        "Sticker | paz (Gold) | Boston 2018",
        "Sticker | NBK- (Gold) | Boston 2018",
        "Sticker | gla1ve (Gold) | Boston 2018",
        "Sticker | mir (Gold) | Boston 2018",
        "Sticker | v4lde (Gold) | Boston 2018",
        "Sticker | dimasick (Gold) | Boston 2018",
        "Sticker | kRYSTAL (Gold) | Boston 2018",
        "Sticker | aizy (Gold) | Boston 2018",
        "Sticker | KRIMZ (Gold) | Boston 2018",
        "Sticker | fitch (Gold) | Boston 2018",
        "Sticker | felps (Gold) | Boston 2018",
        "Sticker | chopper (Gold) | Boston 2018",
        "Sticker | denis (Gold) | Boston 2018",
        "Sticker | oskar (Gold) | Boston 2018",
        "Sticker | STYKO (Gold) | Boston 2018",
        "Sticker | gob b (Gold) | Boston 2018",
        "Sticker | AdreN (Gold) | Boston 2018",
        "Sticker | TaZ (Gold) | Boston 2018",
        "Sticker | SIXER (Gold) | Boston 2018",
        "Sticker | flamie (Gold) | Boston 2018",
        "Sticker | qikert (Gold) | Boston 2018",
        "Sticker | wayLander (Gold) | Boston 2018",
        "Sticker | buster (Gold) | Boston 2018",
        "Sticker | stanislaw (Gold) | Boston 2018",
        "Sticker | hutji (Gold) | Boston 2018",
        "Sticker | zehN (Gold) | Boston 2018",
        "Sticker | xms (Gold) | Boston 2018",
        "Sticker | WorldEdit (Gold) | Boston 2018",
        "Sticker | k0nfig (Gold) | Boston 2018",
        "Sticker | innocent (Gold) | Boston 2018",
        "Sticker | ELEAGUE (Gold) | Boston 2018",
        "Sticker | Flash Gaming (Gold) | Boston 2018",
        "Sticker | Tyloo (Gold) | Boston 2018",
        "Sticker | Quantum Bellator Fire (Gold) | Boston 2018",
        "Sticker | Misfits Gaming (Gold) | Boston 2018",
        "Sticker | Team EnVyUs (Gold) | Boston 2018",
        "Sticker | Renegades (Gold) | Boston 2018",
        "Sticker | Avangar (Gold) | Boston 2018",
        "Sticker | Team Liquid (Gold) | Boston 2018",
        "Sticker | Space Soldiers (Gold) | Boston 2018",
        "Sticker | Vega Squadron (Gold) | Boston 2018",
        "Sticker | FaZe Clan (Gold) | Boston 2018",
        "Sticker | Sprout Esports (Gold) | Boston 2018",
        "Sticker | mousesports (Gold) | Boston 2018",
        "Sticker | Natus Vincere (Gold) | Boston 2018",
        "Sticker | Flipsid3 Tactics (Gold) | Boston 2018",
        "Sticker | Cloud9 (Gold) | Boston 2018",
        "Sticker | G2 Esports (Gold) | Boston 2018",
        "Sticker | North (Gold) | Boston 2018",
        "Sticker | BIG (Gold) | Boston 2018",
        "Sticker | SK Gaming (Gold) | Boston 2018",
        "Sticker | Fnatic (Gold) | Boston 2018",
        "Sticker | Virtus.Pro (Gold) | Boston 2018",
        "Sticker | Astralis (Gold) | Boston 2018",
        "Sticker | 100 Thieves (Gold) | Boston 2018",
        "Sticker | Gambit Esports (Gold) | Boston 2018"
      ]
    },
    "Krakow 2017": {
      "Holo": [
        "Sticker | Cloud9 (Holo) | Krakow 2017",
        "Sticker | FaZe Clan (Holo) | Krakow 2017",
        "Sticker | Flipsid3 Tactics (Holo) | Krakow 2017",
        "Sticker | Immortals (Holo) | Krakow 2017",
        "Sticker | mousesports (Holo) | Krakow 2017",
        "Sticker | Natus Vincere (Holo) | Krakow 2017",
        "Sticker | North (Holo) | Krakow 2017",
        "Sticker | Vega Squadron (Holo) | Krakow 2017",
        "Sticker | Virtus.Pro (Holo) | Krakow 2017",
        "Sticker | G2 Esports (Holo) | Krakow 2017",
        "Sticker | PENTA Sports (Holo) | Krakow 2017",
        "Sticker | SK Gaming (Holo) | Krakow 2017",
        "Sticker | Astralis (Holo) | Krakow 2017",
        "Sticker | Fnatic (Holo) | Krakow 2017",
        "Sticker | BIG (Holo) | Krakow 2017",
        "Sticker | Gambit (Holo) | Krakow 2017",
        "Sticker | PGL (Holo) | Krakow 2017"
      ],
      "Foil": [
        "Sticker | ropz (Foil) | Krakow 2017",
        "Sticker | keshandr (Foil) | Krakow 2017",
        "Sticker | NiKo (Foil) | Krakow 2017",
        "Sticker | kennyS (Foil) | Krakow 2017",
        "Sticker | s1mple (Foil) | Krakow 2017",
        "Sticker | Cloud9 (Foil) | Krakow 2017",
        "Sticker | shroud (Foil) | Krakow 2017",
        "Sticker | rain (Foil) | Krakow 2017",
        "Sticker | keev (Foil) | Krakow 2017",
        "Sticker | Flipsid3 Tactics (Foil) | Krakow 2017",
        "Sticker | mousesports (Foil) | Krakow 2017",
        "Sticker | device (Foil) | Krakow 2017",
        "Sticker | FalleN (Foil) | Krakow 2017",
        "Sticker | LEGIJA (Foil) | Krakow 2017",
        "Sticker | mir (Foil) | Krakow 2017",
        "Sticker | apEX (Foil) | Krakow 2017",
        "Sticker | Stewie2K (Foil) | Krakow 2017",
        "Sticker | electronic (Foil) | Krakow 2017",
        "Sticker | Immortals (Foil) | Krakow 2017",
        "Sticker | suNny (Foil) | Krakow 2017",
        "Sticker | Vega Squadron (Foil) | Krakow 2017",
        "Sticker | FaZe Clan (Foil) | Krakow 2017",
        "Sticker | Virtus.Pro (Foil) | Krakow 2017",
        "Sticker | loWel (Foil) | Krakow 2017",
        "Sticker | Skadoodle (Foil) | Krakow 2017",
        "Sticker | Magisk (Foil) | Krakow 2017",
        "Sticker | G2 Esports (Foil) | Krakow 2017",
        "Sticker | karrigan (Foil) | Krakow 2017",
        "Sticker | B1ad3 (Foil) | Krakow 2017",
        "Sticker | chopper (Foil) | Krakow 2017",
        "Sticker | North (Foil) | Krakow 2017",
        "Sticker | pashaBiceps (Foil) | Krakow 2017",
        "Sticker | AdreN (Foil) | Krakow 2017",
        "Sticker | shox (Foil) | Krakow 2017",
        "Sticker | SK Gaming (Foil) | Krakow 2017",
        "Sticker | jR (Foil) | Krakow 2017",
        "Sticker | MSL (Foil) | Krakow 2017",
        "Sticker | markeloff (Foil) | Krakow 2017",
        "Sticker | hutji (Foil) | Krakow 2017",
        "Sticker | Astralis (Foil) | Krakow 2017",
        "Sticker | WorldEdit (Foil) | Krakow 2017",
        "Sticker | oskar (Foil) | Krakow 2017",
        "Sticker | coldzera (Foil) | Krakow 2017",
        "Sticker | denis (Foil) | Krakow 2017",
        "Sticker | Natus Vincere (Foil) | Krakow 2017",
        "Sticker | wayLander (Foil) | Krakow 2017",
        "Sticker | chrisJ (Foil) | Krakow 2017",
        "Sticker | autimatic (Foil) | Krakow 2017",
        "Sticker | n0thing (Foil) | Krakow 2017",
        "Sticker | HS (Foil) | Krakow 2017",
        "Sticker | aizy (Foil) | Krakow 2017",
        "Sticker | Fnatic (Foil) | Krakow 2017",
        "Sticker | innocent (Foil) | Krakow 2017",
        "Sticker | kRYSTAL (Foil) | Krakow 2017",
        "Sticker | nex (Foil) | Krakow 2017",
        "Sticker | k0nfig (Foil) | Krakow 2017",
        "Sticker | NBK- (Foil) | Krakow 2017",
        "Sticker | LUCAS1 (Foil) | Krakow 2017",
        "Sticker | cajunb (Foil) | Krakow 2017",
        "Sticker | NEO (Foil) | Krakow 2017",
        "Sticker | Gambit (Foil) | Krakow 2017",
        "Sticker | tabseN (Foil) | Krakow 2017",
        "Sticker | fer (Foil) | Krakow 2017",
        "Sticker | HEN1 (Foil) | Krakow 2017",
        "Sticker | gob b (Foil) | Krakow 2017",
        "Sticker | felps (Foil) | Krakow 2017",
        "Sticker | JW (Foil) | Krakow 2017",
        "Sticker | kNgV- (Foil) | Krakow 2017",
        "Sticker | GuardiaN (Foil) | Krakow 2017",
        "Sticker | PGL (Foil) | Krakow 2017",
        "Sticker | bodyy (Foil) | Krakow 2017",
        "Sticker | Snax (Foil) | Krakow 2017",
        "Sticker | zehN (Foil) | Krakow 2017",
        "Sticker | TACO (Foil) | Krakow 2017",
        "Sticker | PENTA Sports (Foil) | Krakow 2017",
        "Sticker | boltz (Foil) | Krakow 2017",
        "Sticker | dupreeh (Foil) | Krakow 2017",
        "Sticker | olofmeister (Foil) | Krakow 2017",
        "Sticker | dennis (Foil) | Krakow 2017",
        "Sticker | TaZ (Foil) | Krakow 2017",
        "Sticker | steel (Foil) | Krakow 2017",
        "Sticker | kioShiMa (Foil) | Krakow 2017",
        "Sticker | allu (Foil) | Krakow 2017",
        "Sticker | BIG (Foil) | Krakow 2017",
        "Sticker | flusha (Foil) | Krakow 2017",
        "Sticker | Edward (Foil) | Krakow 2017",
        "Sticker | byali (Foil) | Krakow 2017",
        "Sticker | KRIMZ (Foil) | Krakow 2017",
        "Sticker | Zeus (Foil) | Krakow 2017",
        "Sticker | Dosia (Foil) | Krakow 2017",
        "Sticker | Xyp9x (Foil) | Krakow 2017",
        "Sticker | gla1ve (Foil) | Krakow 2017",
        "Sticker | mou (Foil) | Krakow 2017",
        "Sticker | Hobbit (Foil) | Krakow 2017",
        "Sticker | Kjaerbye (Foil) | Krakow 2017",
        "Sticker | seized (Foil) | Krakow 2017",
        "Sticker | flamie (Foil) | Krakow 2017"
      ],
      "Paper": [
        "Sticker | ropz | Krakow 2017",
        "Sticker | NiKo | Krakow 2017",
        "Sticker | s1mple | Krakow 2017",
        "Sticker | kennyS | Krakow 2017",
        "Sticker | keshandr | Krakow 2017",
        "Sticker | rain | Krakow 2017",
        "Sticker | shroud | Krakow 2017",
        "Sticker | device | Krakow 2017",
        "Sticker | Flipsid3 Tactics | Krakow 2017",
        "Sticker | electronic | Krakow 2017",
        "Sticker | FalleN | Krakow 2017",
        "Sticker | B1ad3 | Krakow 2017",
        "Sticker | pashaBiceps | Krakow 2017",
        "Sticker | markeloff | Krakow 2017",
        "Sticker | Stewie2K | Krakow 2017",
        "Sticker | mousesports | Krakow 2017",
        "Sticker | karrigan | Krakow 2017",
        "Sticker | MSL | Krakow 2017",
        "Sticker | AdreN | Krakow 2017",
        "Sticker | WorldEdit | Krakow 2017",
        "Sticker | chopper | Krakow 2017",
        "Sticker | mir | Krakow 2017",
        "Sticker | denis | Krakow 2017",
        "Sticker | NEO | Krakow 2017",
        "Sticker | Skadoodle | Krakow 2017",
        "Sticker | apEX | Krakow 2017",
        "Sticker | n0thing | Krakow 2017",
        "Sticker | Magisk | Krakow 2017",
        "Sticker | loWel | Krakow 2017",
        "Sticker | oskar | Krakow 2017",
        "Sticker | jR | Krakow 2017",
        "Sticker | wayLander | Krakow 2017",
        "Sticker | Snax | Krakow 2017",
        "Sticker | olofmeister | Krakow 2017",
        "Sticker | GuardiaN | Krakow 2017",
        "Sticker | Virtus.Pro | Krakow 2017",
        "Sticker | LUCAS1 | Krakow 2017",
        "Sticker | chrisJ | Krakow 2017",
        "Sticker | allu | Krakow 2017",
        "Sticker | keev | Krakow 2017",
        "Sticker | suNny | Krakow 2017",
        "Sticker | kNgV- | Krakow 2017",
        "Sticker | Vega Squadron | Krakow 2017",
        "Sticker | Dosia | Krakow 2017",
        "Sticker | coldzera | Krakow 2017",
        "Sticker | Zeus | Krakow 2017",
        "Sticker | JW | Krakow 2017",
        "Sticker | k0nfig | Krakow 2017",
        "Sticker | Natus Vincere | Krakow 2017",
        "Sticker | hutji | Krakow 2017",
        "Sticker | Edward | Krakow 2017",
        "Sticker | Cloud9 | Krakow 2017",
        "Sticker | autimatic | Krakow 2017",
        "Sticker | flamie | Krakow 2017",
        "Sticker | TACO | Krakow 2017",
        "Sticker | dupreeh | Krakow 2017",
        "Sticker | byali | Krakow 2017",
        "Sticker | cajunb | Krakow 2017",
        "Sticker | TaZ | Krakow 2017",
        "Sticker | mou | Krakow 2017",
        "Sticker | aizy | Krakow 2017",
        "Sticker | KRIMZ | Krakow 2017",
        "Sticker | HS | Krakow 2017",
        "Sticker | boltz | Krakow 2017",
        "Sticker | SK Gaming | Krakow 2017",
        "Sticker | Xyp9x | Krakow 2017",
        "Sticker | Kjaerbye | Krakow 2017",
        "Sticker | gla1ve | Krakow 2017",
        "Sticker | NBK- | Krakow 2017",
        "Sticker | LEGIJA | Krakow 2017",
        "Sticker | Astralis | Krakow 2017",
        "Sticker | FaZe Clan | Krakow 2017",
        "Sticker | kioShiMa | Krakow 2017",
        "Sticker | Fnatic | Krakow 2017",
        "Sticker | seized | Krakow 2017",
        "Sticker | Hobbit | Krakow 2017",
        "Sticker | HEN1 | Krakow 2017",
        "Sticker | dennis | Krakow 2017",
        "Sticker | flusha | Krakow 2017",
        "Sticker | Immortals | Krakow 2017",
        "Sticker | fer | Krakow 2017",
        "Sticker | North | Krakow 2017",
        "Sticker | steel | Krakow 2017",
        "Sticker | shox | Krakow 2017",
        "Sticker | bodyy | Krakow 2017",
        "Sticker | zehN | Krakow 2017",
        "Sticker | PENTA Sports | Krakow 2017",
        "Sticker | innocent | Krakow 2017",
        "Sticker | nex | Krakow 2017",
        "Sticker | felps | Krakow 2017",
        "Sticker | tabseN | Krakow 2017",
        "Sticker | gob b | Krakow 2017",
        "Sticker | G2 Esports | Krakow 2017",
        "Sticker | kRYSTAL | Krakow 2017",
        "Sticker | PGL | Krakow 2017",
        "Sticker | Gambit | Krakow 2017",
        "Sticker | BIG | Krakow 2017"
      ],
      "Gold": [
        "Sticker | s1mple (Gold) | Krakow 2017",
        "Sticker | keshandr (Gold) | Krakow 2017",
        "Sticker | ropz (Gold) | Krakow 2017",
        "Sticker | keev (Gold) | Krakow 2017",
        "Sticker | kennyS (Gold) | Krakow 2017",
        "Sticker | LEGIJA (Gold) | Krakow 2017",
        "Sticker | NiKo (Gold) | Krakow 2017",
        "Sticker | suNny (Gold) | Krakow 2017",
        "Sticker | LUCAS1 (Gold) | Krakow 2017",
        "Sticker | mir (Gold) | Krakow 2017",
        "Sticker | apEX (Gold) | Krakow 2017",
        "Sticker | GuardiaN (Gold) | Krakow 2017",
        "Sticker | device (Gold) | Krakow 2017",
        "Sticker | nex (Gold) | Krakow 2017",
        "Sticker | Skadoodle (Gold) | Krakow 2017",
        "Sticker | rain (Gold) | Krakow 2017",
        "Sticker | flamie (Gold) | Krakow 2017",
        "Sticker | pashaBiceps (Gold) | Krakow 2017",
        "Sticker | electronic (Gold) | Krakow 2017",
        "Sticker | FalleN (Gold) | Krakow 2017",
        "Sticker | Stewie2K (Gold) | Krakow 2017",
        "Sticker | HS (Gold) | Krakow 2017",
        "Sticker | NBK- (Gold) | Krakow 2017",
        "Sticker | jR (Gold) | Krakow 2017",
        "Sticker | JW (Gold) | Krakow 2017",
        "Sticker | tabseN (Gold) | Krakow 2017",
        "Sticker | shox (Gold) | Krakow 2017",
        "Sticker | karrigan (Gold) | Krakow 2017",
        "Sticker | olofmeister (Gold) | Krakow 2017",
        "Sticker | NEO (Gold) | Krakow 2017",
        "Sticker | kRYSTAL (Gold) | Krakow 2017",
        "Sticker | MSL (Gold) | Krakow 2017",
        "Sticker | WorldEdit (Gold) | Krakow 2017",
        "Sticker | AdreN (Gold) | Krakow 2017",
        "Sticker | Edward (Gold) | Krakow 2017",
        "Sticker | shroud (Gold) | Krakow 2017",
        "Sticker | HEN1 (Gold) | Krakow 2017",
        "Sticker | autimatic (Gold) | Krakow 2017",
        "Sticker | Magisk (Gold) | Krakow 2017",
        "Sticker | gob b (Gold) | Krakow 2017",
        "Sticker | hutji (Gold) | Krakow 2017",
        "Sticker | chopper (Gold) | Krakow 2017",
        "Sticker | bodyy (Gold) | Krakow 2017",
        "Sticker | flusha (Gold) | Krakow 2017",
        "Sticker | gla1ve (Gold) | Krakow 2017",
        "Sticker | kNgV- (Gold) | Krakow 2017",
        "Sticker | Dosia (Gold) | Krakow 2017",
        "Sticker | zehN (Gold) | Krakow 2017",
        "Sticker | dupreeh (Gold) | Krakow 2017",
        "Sticker | n0thing (Gold) | Krakow 2017",
        "Sticker | coldzera (Gold) | Krakow 2017",
        "Sticker | TACO (Gold) | Krakow 2017",
        "Sticker | innocent (Gold) | Krakow 2017",
        "Sticker | seized (Gold) | Krakow 2017",
        "Sticker | B1ad3 (Gold) | Krakow 2017",
        "Sticker | wayLander (Gold) | Krakow 2017",
        "Sticker | k0nfig (Gold) | Krakow 2017",
        "Sticker | fer (Gold) | Krakow 2017",
        "Sticker | dennis (Gold) | Krakow 2017",
        "Sticker | TaZ (Gold) | Krakow 2017",
        "Sticker | denis (Gold) | Krakow 2017",
        "Sticker | felps (Gold) | Krakow 2017",
        "Sticker | steel (Gold) | Krakow 2017",
        "Sticker | markeloff (Gold) | Krakow 2017",
        "Sticker | Xyp9x (Gold) | Krakow 2017",
        "Sticker | Zeus (Gold) | Krakow 2017",
        "Sticker | Snax (Gold) | Krakow 2017",
        "Sticker | chrisJ (Gold) | Krakow 2017",
        "Sticker | kioShiMa (Gold) | Krakow 2017",
        "Sticker | cajunb (Gold) | Krakow 2017",
        "Sticker | allu (Gold) | Krakow 2017",
        "Sticker | mou (Gold) | Krakow 2017",
        "Sticker | byali (Gold) | Krakow 2017",
        "Sticker | loWel (Gold) | Krakow 2017",
        "Sticker | Hobbit (Gold) | Krakow 2017",
        "Sticker | oskar (Gold) | Krakow 2017",
        "Sticker | aizy (Gold) | Krakow 2017",
        "Sticker | KRIMZ (Gold) | Krakow 2017",
        "Sticker | boltz (Gold) | Krakow 2017",
        "Sticker | Kjaerbye (Gold) | Krakow 2017",
        "Sticker | PGL (Gold) | Krakow 2017",
        "Sticker | Vega Squadron (Gold) | Krakow 2017",
        "Sticker | Immortals (Gold) | Krakow 2017",
        "Sticker | Flipsid3 Tactics (Gold) | Krakow 2017",
        "Sticker | PENTA Sports (Gold) | Krakow 2017",
        "Sticker | Cloud9 (Gold) | Krakow 2017",
        "Sticker | BIG (Gold) | Krakow 2017",
        "Sticker | G2 Esports (Gold) | Krakow 2017",
        "Sticker | mousesports (Gold) | Krakow 2017",
        "Sticker | FaZe Clan (Gold) | Krakow 2017",
        "Sticker | North (Gold) | Krakow 2017",
        "Sticker | Gambit (Gold) | Krakow 2017",
        "Sticker | Natus Vincere (Gold) | Krakow 2017",
        "Sticker | SK Gaming (Gold) | Krakow 2017",
        "Sticker | Fnatic (Gold) | Krakow 2017",
        "Sticker | Virtus.Pro (Gold) | Krakow 2017",
        "Sticker | Astralis (Gold) | Krakow 2017"
      ]
    },
    "Atlanta 2017": {
      "Holo": [
        "Sticker | OpTic Gaming (Holo) | Atlanta 2017",
        "Sticker | SK Gaming (Holo) | Atlanta 2017",
        "Sticker | Team Liquid (Holo) | Atlanta 2017",
        "Sticker | Flipsid3 Tactics (Holo) | Atlanta 2017",
        "Sticker | HellRaisers (Holo) | Atlanta 2017",
        "Sticker | mousesports (Holo) | Atlanta 2017",
        "Sticker | G2 Esports (Holo) | Atlanta 2017",
        "Sticker | FaZe Clan (Holo) | Atlanta 2017",
        "Sticker | Team EnVyUs (Holo) | Atlanta 2017",
        "Sticker | Fnatic (Holo) | Atlanta 2017",
        "Sticker | Astralis (Holo) | Atlanta 2017",
        "Sticker | Natus Vincere (Holo) | Atlanta 2017",
        "Sticker | Virtus.Pro (Holo) | Atlanta 2017",
        "Sticker | GODSENT (Holo) | Atlanta 2017",
        "Sticker | North (Holo) | Atlanta 2017",
        "Sticker | Gambit Gaming (Holo) | Atlanta 2017",
        "Sticker | ELEAGUE (Holo) | Atlanta 2017"
      ],
      "Foil": [
        "Sticker | s1mple (Foil) | Atlanta 2017",
        "Sticker | Team Liquid (Foil) | Atlanta 2017",
        "Sticker | MSL (Foil) | Atlanta 2017",
        "Sticker | Magisk (Foil) | Atlanta 2017",
        "Sticker | OpTic Gaming (Foil) | Atlanta 2017",
        "Sticker | cajunb (Foil) | Atlanta 2017",
        "Sticker | RUBINO (Foil) | Atlanta 2017",
        "Sticker | k0nfig (Foil) | Atlanta 2017",
        "Sticker | NiKo (Foil) | Atlanta 2017",
        "Sticker | rain (Foil) | Atlanta 2017",
        "Sticker | Flipsid3 Tactics (Foil) | Atlanta 2017",
        "Sticker | kennyS (Foil) | Atlanta 2017",
        "Sticker | mixwell (Foil) | Atlanta 2017",
        "Sticker | ScreaM (Foil) | Atlanta 2017",
        "Sticker | Snax (Foil) | Atlanta 2017",
        "Sticker | Astralis (Foil) | Atlanta 2017",
        "Sticker | Pimp (Foil) | Atlanta 2017",
        "Sticker | mousesports (Foil) | Atlanta 2017",
        "Sticker | FaZe Clan (Foil) | Atlanta 2017",
        "Sticker | apEX (Foil) | Atlanta 2017",
        "Sticker | RUSH (Foil) | Atlanta 2017",
        "Sticker | HellRaisers (Foil) | Atlanta 2017",
        "Sticker | EliGE (Foil) | Atlanta 2017",
        "Sticker | jdm64 (Foil) | Atlanta 2017",
        "Sticker | Hiko (Foil) | Atlanta 2017",
        "Sticker | device (Foil) | Atlanta 2017",
        "Sticker | electronic (Foil) | Atlanta 2017",
        "Sticker | Virtus.Pro (Foil) | Atlanta 2017",
        "Sticker | karrigan (Foil) | Atlanta 2017",
        "Sticker | G2 Esports (Foil) | Atlanta 2017",
        "Sticker | Natus Vincere (Foil) | Atlanta 2017",
        "Sticker | Zero (Foil) | Atlanta 2017",
        "Sticker | North (Foil) | Atlanta 2017",
        "Sticker | Fnatic (Foil) | Atlanta 2017",
        "Sticker | olofmeister (Foil) | Atlanta 2017",
        "Sticker | tarik (Foil) | Atlanta 2017",
        "Sticker | pashaBiceps (Foil) | Atlanta 2017",
        "Sticker | GuardiaN (Foil) | Atlanta 2017",
        "Sticker | dupreeh (Foil) | Atlanta 2017",
        "Sticker | nitr0 (Foil) | Atlanta 2017",
        "Sticker | NAF (Foil) | Atlanta 2017",
        "Sticker | Team EnVyUs (Foil) | Atlanta 2017",
        "Sticker | WorldEdit (Foil) | Atlanta 2017",
        "Sticker | SK Gaming (Foil) | Atlanta 2017",
        "Sticker | Happy (Foil) | Atlanta 2017",
        "Sticker | B1ad3 (Foil) | Atlanta 2017",
        "Sticker | FalleN (Foil) | Atlanta 2017",
        "Sticker | NEO (Foil) | Atlanta 2017",
        "Sticker | AdreN (Foil) | Atlanta 2017",
        "Sticker | DeadFox (Foil) | Atlanta 2017",
        "Sticker | fox (Foil) | Atlanta 2017",
        "Sticker | Edward (Foil) | Atlanta 2017",
        "Sticker | SIXER (Foil) | Atlanta 2017",
        "Sticker | GODSENT (Foil) | Atlanta 2017",
        "Sticker | chrisJ (Foil) | Atlanta 2017",
        "Sticker | markeloff (Foil) | Atlanta 2017",
        "Sticker | NBK- (Foil) | Atlanta 2017",
        "Sticker | Xyp9x (Foil) | Atlanta 2017",
        "Sticker | allu (Foil) | Atlanta 2017",
        "Sticker | flamie (Foil) | Atlanta 2017",
        "Sticker | coldzera (Foil) | Atlanta 2017",
        "Sticker | Zeus (Foil) | Atlanta 2017",
        "Sticker | STYKO (Foil) | Atlanta 2017",
        "Sticker | shox (Foil) | Atlanta 2017",
        "Sticker | JW (Foil) | Atlanta 2017",
        "Sticker | dennis (Foil) | Atlanta 2017",
        "Sticker | ANGE1 (Foil) | Atlanta 2017",
        "Sticker | Lekr0 (Foil) | Atlanta 2017",
        "Sticker | fer (Foil) | Atlanta 2017",
        "Sticker | aizy (Foil) | Atlanta 2017",
        "Sticker | gla1ve (Foil) | Atlanta 2017",
        "Sticker | kioShiMa (Foil) | Atlanta 2017",
        "Sticker | RpK (Foil) | Atlanta 2017",
        "Sticker | Kjaerbye (Foil) | Atlanta 2017",
        "Sticker | wayLander (Foil) | Atlanta 2017",
        "Sticker | stanislaw (Foil) | Atlanta 2017",
        "Sticker | bodyy (Foil) | Atlanta 2017",
        "Sticker | SmithZz (Foil) | Atlanta 2017",
        "Sticker | TaZ (Foil) | Atlanta 2017",
        "Sticker | Spiidi (Foil) | Atlanta 2017",
        "Sticker | loWel (Foil) | Atlanta 2017",
        "Sticker | KRIMZ (Foil) | Atlanta 2017",
        "Sticker | TACO (Foil) | Atlanta 2017",
        "Sticker | Gambit Gaming (Foil) | Atlanta 2017",
        "Sticker | flusha (Foil) | Atlanta 2017",
        "Sticker | pronax (Foil) | Atlanta 2017",
        "Sticker | Dosia (Foil) | Atlanta 2017",
        "Sticker | byali (Foil) | Atlanta 2017",
        "Sticker | bondik (Foil) | Atlanta 2017",
        "Sticker | seized (Foil) | Atlanta 2017",
        "Sticker | denis (Foil) | Atlanta 2017",
        "Sticker | znajder (Foil) | Atlanta 2017",
        "Sticker | mou (Foil) | Atlanta 2017",
        "Sticker | Hobbit (Foil) | Atlanta 2017",
        "Sticker | twist (Foil) | Atlanta 2017",
        "Sticker | ELEAGUE (Foil) | Atlanta 2017",
        "Sticker | disco doplan (Foil) | Atlanta 2017"
      ],
      "Paper": [
        "Sticker | s1mple | Atlanta 2017",
        "Sticker | NiKo | Atlanta 2017",
        "Sticker | ScreaM | Atlanta 2017",
        "Sticker | Flipsid3 Tactics | Atlanta 2017",
        "Sticker | OpTic Gaming | Atlanta 2017",
        "Sticker | Zero | Atlanta 2017",
        "Sticker | kennyS | Atlanta 2017",
        "Sticker | mousesports | Atlanta 2017",
        "Sticker | mixwell | Atlanta 2017",
        "Sticker | device | Atlanta 2017",
        "Sticker | Pimp | Atlanta 2017",
        "Sticker | rain | Atlanta 2017",
        "Sticker | tarik | Atlanta 2017",
        "Sticker | RUSH | Atlanta 2017",
        "Sticker | NAF | Atlanta 2017",
        "Sticker | Team Liquid | Atlanta 2017",
        "Sticker | HellRaisers | Atlanta 2017",
        "Sticker | EliGE | Atlanta 2017",
        "Sticker | MSL | Atlanta 2017",
        "Sticker | markeloff | Atlanta 2017",
        "Sticker | B1ad3 | Atlanta 2017",
        "Sticker | jdm64 | Atlanta 2017",
        "Sticker | WorldEdit | Atlanta 2017",
        "Sticker | FaZe Clan | Atlanta 2017",
        "Sticker | karrigan | Atlanta 2017",
        "Sticker | electronic | Atlanta 2017",
        "Sticker | fox | Atlanta 2017",
        "Sticker | Hiko | Atlanta 2017",
        "Sticker | Astralis | Atlanta 2017",
        "Sticker | DeadFox | Atlanta 2017",
        "Sticker | RpK | Atlanta 2017",
        "Sticker | ANGE1 | Atlanta 2017",
        "Sticker | wayLander | Atlanta 2017",
        "Sticker | Magisk | Atlanta 2017",
        "Sticker | FalleN | Atlanta 2017",
        "Sticker | Dosia | Atlanta 2017",
        "Sticker | Happy | Atlanta 2017",
        "Sticker | AdreN | Atlanta 2017",
        "Sticker | denis | Atlanta 2017",
        "Sticker | nitr0 | Atlanta 2017",
        "Sticker | stanislaw | Atlanta 2017",
        "Sticker | Natus Vincere | Atlanta 2017",
        "Sticker | G2 Esports | Atlanta 2017",
        "Sticker | pashaBiceps | Atlanta 2017",
        "Sticker | k0nfig | Atlanta 2017",
        "Sticker | RUBINO | Atlanta 2017",
        "Sticker | Spiidi | Atlanta 2017",
        "Sticker | Virtus.Pro | Atlanta 2017",
        "Sticker | STYKO | Atlanta 2017",
        "Sticker | bodyy | Atlanta 2017",
        "Sticker | kioShiMa | Atlanta 2017",
        "Sticker | allu | Atlanta 2017",
        "Sticker | Xyp9x | Atlanta 2017",
        "Sticker | Team EnVyUs | Atlanta 2017",
        "Sticker | GuardiaN | Atlanta 2017",
        "Sticker | cajunb | Atlanta 2017",
        "Sticker | apEX | Atlanta 2017",
        "Sticker | SIXER | Atlanta 2017",
        "Sticker | chrisJ | Atlanta 2017",
        "Sticker | bondik | Atlanta 2017",
        "Sticker | shox | Atlanta 2017",
        "Sticker | dupreeh | Atlanta 2017",
        "Sticker | Fnatic | Atlanta 2017",
        "Sticker | SK Gaming | Atlanta 2017",
        "Sticker | mou | Atlanta 2017",
        "Sticker | olofmeister | Atlanta 2017",
        "Sticker | Zeus | Atlanta 2017",
        "Sticker | NBK- | Atlanta 2017",
        "Sticker | aizy | Atlanta 2017",
        "Sticker | Snax | Atlanta 2017",
        "Sticker | gla1ve | Atlanta 2017",
        "Sticker | flusha | Atlanta 2017",
        "Sticker | NEO | Atlanta 2017",
        "Sticker | seized | Atlanta 2017",
        "Sticker | Edward | Atlanta 2017",
        "Sticker | coldzera | Atlanta 2017",
        "Sticker | fer | Atlanta 2017",
        "Sticker | Hobbit | Atlanta 2017",
        "Sticker | North | Atlanta 2017",
        "Sticker | loWel | Atlanta 2017",
        "Sticker | flamie | Atlanta 2017",
        "Sticker | twist | Atlanta 2017",
        "Sticker | pronax | Atlanta 2017",
        "Sticker | Lekr0 | Atlanta 2017",
        "Sticker | TACO | Atlanta 2017",
        "Sticker | Kjaerbye | Atlanta 2017",
        "Sticker | JW | Atlanta 2017",
        "Sticker | znajder | Atlanta 2017",
        "Sticker | dennis | Atlanta 2017",
        "Sticker | SmithZz | Atlanta 2017",
        "Sticker | TaZ | Atlanta 2017",
        "Sticker | disco doplan | Atlanta 2017",
        "Sticker | KRIMZ | Atlanta 2017",
        "Sticker | Gambit Gaming | Atlanta 2017",
        "Sticker | GODSENT | Atlanta 2017",
        "Sticker | byali | Atlanta 2017",
        "Sticker | ELEAGUE | Atlanta 2017"
      ],
      "Gold": [
        "Sticker | TaZ (Gold) | Atlanta 2017",
        "Sticker | Snax (Gold) | Atlanta 2017",
        "Sticker | pashaBiceps (Gold) | Atlanta 2017",
        "Sticker | NEO (Gold) | Atlanta 2017",
        "Sticker | byali (Gold) | Atlanta 2017",
        "Sticker | AdreN (Gold) | Atlanta 2017",
        "Sticker | mou (Gold) | Atlanta 2017",
        "Sticker | Hobbit (Gold) | Atlanta 2017",
        "Sticker | Dosia (Gold) | Atlanta 2017",
        "Sticker | Zeus (Gold) | Atlanta 2017",
        "Sticker | Xyp9x (Gold) | Atlanta 2017",
        "Sticker | Kjaerbye (Gold) | Atlanta 2017",
        "Sticker | dupreeh (Gold) | Atlanta 2017",
        "Sticker | device (Gold) | Atlanta 2017",
        "Sticker | gla1ve (Gold) | Atlanta 2017",
        "Sticker | SmithZz (Gold) | Atlanta 2017",
        "Sticker | shox (Gold) | Atlanta 2017",
        "Sticker | ScreaM (Gold) | Atlanta 2017",
        "Sticker | RpK (Gold) | Atlanta 2017",
        "Sticker | bodyy (Gold) | Atlanta 2017",
        "Sticker | nitr0 (Gold) | Atlanta 2017",
        "Sticker | Hiko (Gold) | Atlanta 2017",
        "Sticker | Pimp (Gold) | Atlanta 2017",
        "Sticker | EliGE (Gold) | Atlanta 2017",
        "Sticker | jdm64 (Gold) | Atlanta 2017",
        "Sticker | k0nfig (Gold) | Atlanta 2017",
        "Sticker | RUBINO (Gold) | Atlanta 2017",
        "Sticker | Magisk (Gold) | Atlanta 2017",
        "Sticker | MSL (Gold) | Atlanta 2017",
        "Sticker | cajunb (Gold) | Atlanta 2017",
        "Sticker | flusha (Gold) | Atlanta 2017",
        "Sticker | JW (Gold) | Atlanta 2017",
        "Sticker | pronax (Gold) | Atlanta 2017",
        "Sticker | Lekr0 (Gold) | Atlanta 2017",
        "Sticker | znajder (Gold) | Atlanta 2017",
        "Sticker | s1mple (Gold) | Atlanta 2017",
        "Sticker | seized (Gold) | Atlanta 2017",
        "Sticker | GuardiaN (Gold) | Atlanta 2017",
        "Sticker | flamie (Gold) | Atlanta 2017",
        "Sticker | Edward (Gold) | Atlanta 2017",
        "Sticker | NiKo (Gold) | Atlanta 2017",
        "Sticker | loWel (Gold) | Atlanta 2017",
        "Sticker | Spiidi (Gold) | Atlanta 2017",
        "Sticker | denis (Gold) | Atlanta 2017",
        "Sticker | chrisJ (Gold) | Atlanta 2017",
        "Sticker | TACO (Gold) | Atlanta 2017",
        "Sticker | fox (Gold) | Atlanta 2017",
        "Sticker | fer (Gold) | Atlanta 2017",
        "Sticker | FalleN (Gold) | Atlanta 2017",
        "Sticker | coldzera (Gold) | Atlanta 2017",
        "Sticker | karrigan (Gold) | Atlanta 2017",
        "Sticker | rain (Gold) | Atlanta 2017",
        "Sticker | kioShiMa (Gold) | Atlanta 2017",
        "Sticker | allu (Gold) | Atlanta 2017",
        "Sticker | aizy (Gold) | Atlanta 2017",
        "Sticker | dennis (Gold) | Atlanta 2017",
        "Sticker | olofmeister (Gold) | Atlanta 2017",
        "Sticker | KRIMZ (Gold) | Atlanta 2017",
        "Sticker | disco doplan (Gold) | Atlanta 2017",
        "Sticker | twist (Gold) | Atlanta 2017",
        "Sticker | WorldEdit (Gold) | Atlanta 2017",
        "Sticker | markeloff (Gold) | Atlanta 2017",
        "Sticker | electronic (Gold) | Atlanta 2017",
        "Sticker | wayLander (Gold) | Atlanta 2017",
        "Sticker | B1ad3 (Gold) | Atlanta 2017",
        "Sticker | NBK- (Gold) | Atlanta 2017",
        "Sticker | kennyS (Gold) | Atlanta 2017",
        "Sticker | SIXER (Gold) | Atlanta 2017",
        "Sticker | Happy (Gold) | Atlanta 2017",
        "Sticker | apEX (Gold) | Atlanta 2017",
        "Sticker | stanislaw (Gold) | Atlanta 2017",
        "Sticker | RUSH (Gold) | Atlanta 2017",
        "Sticker | NAF (Gold) | Atlanta 2017",
        "Sticker | mixwell (Gold) | Atlanta 2017",
        "Sticker | tarik (Gold) | Atlanta 2017",
        "Sticker | ANGE1 (Gold) | Atlanta 2017",
        "Sticker | bondik (Gold) | Atlanta 2017",
        "Sticker | DeadFox (Gold) | Atlanta 2017",
        "Sticker | Zero (Gold) | Atlanta 2017",
        "Sticker | STYKO (Gold) | Atlanta 2017",
        "Sticker | ELEAGUE (Gold) | Atlanta 2017",
        "Sticker | Virtus.Pro (Gold) | Atlanta 2017",
        "Sticker | Team Liquid (Gold) | Atlanta 2017",
        "Sticker | SK Gaming (Gold) | Atlanta 2017",
        "Sticker | OpTic Gaming (Gold) | Atlanta 2017",
        "Sticker | North (Gold) | Atlanta 2017",
        "Sticker | Natus Vincere (Gold) | Atlanta 2017",
        "Sticker | mousesports (Gold) | Atlanta 2017",
        "Sticker | HellRaisers (Gold) | Atlanta 2017",
        "Sticker | GODSENT (Gold) | Atlanta 2017",
        "Sticker | Gambit Gaming (Gold) | Atlanta 2017",
        "Sticker | G2 Esports (Gold) | Atlanta 2017",
        "Sticker | Fnatic (Gold) | Atlanta 2017",
        "Sticker | Flipsid3 Tactics (Gold) | Atlanta 2017",
        "Sticker | FaZe Clan (Gold) | Atlanta 2017",
        "Sticker | Team EnVyUs (Gold) | Atlanta 2017",
        "Sticker | Astralis (Gold) | Atlanta 2017"
      ]
    }
  },
  "Tier 4": {
    "Cologne 2016": {
      "Holo": [
        "Sticker | Team Dignitas (Holo) | Cologne 2016",
        "Sticker | Counter Logic Gaming (Holo) | Cologne 2016",
        "Sticker | OpTic Gaming (Holo) | Cologne 2016",
        "Sticker | SK Gaming (Holo) | Cologne 2016",
        "Sticker | Flipsid3 Tactics (Holo) | Cologne 2016",
        "Sticker | mousesports (Holo) | Cologne 2016",
        "Sticker | Team Liquid (Holo) | Cologne 2016",
        "Sticker | Astralis (Holo) | Cologne 2016",
        "Sticker | FaZe Clan (Holo) | Cologne 2016",
        "Sticker | Team EnVyUs (Holo) | Cologne 2016",
        "Sticker | Natus Vincere (Holo) | Cologne 2016",
        "Sticker | G2 Esports (Holo) | Cologne 2016",
        "Sticker | Virtus.Pro (Holo) | Cologne 2016",
        "Sticker | Fnatic (Holo) | Cologne 2016",
        "Sticker | Ninjas in Pyjamas (Holo) | Cologne 2016",
        "Sticker | Gambit Gaming (Holo) | Cologne 2016",
        "Sticker | ESL (Holo) | Cologne 2016"
      ],
      "Foil": [
        "Sticker | ScreaM (Foil) | Cologne 2016",
        "Sticker | s1mple (Foil) | Cologne 2016",
        "Sticker | kennyS (Foil) | Cologne 2016",
        "Sticker | NiKo (Foil) | Cologne 2016",
        "Sticker | rain (Foil) | Cologne 2016",
        "Sticker | Team Dignitas (Foil) | Cologne 2016",
        "Sticker | fox (Foil) | Cologne 2016",
        "Sticker | device (Foil) | Cologne 2016",
        "Sticker | FalleN (Foil) | Cologne 2016",
        "Sticker | Happy (Foil) | Cologne 2016",
        "Sticker | OpTic Gaming (Foil) | Cologne 2016",
        "Sticker | shox (Foil) | Cologne 2016",
        "Sticker | WorldEdit (Foil) | Cologne 2016",
        "Sticker | NBK- (Foil) | Cologne 2016",
        "Sticker | apEX (Foil) | Cologne 2016",
        "Sticker | Counter Logic Gaming (Foil) | Cologne 2016",
        "Sticker | Astralis (Foil) | Cologne 2016",
        "Sticker | Spiidi (Foil) | Cologne 2016",
        "Sticker | markeloff (Foil) | Cologne 2016",
        "Sticker | DEVIL (Foil) | Cologne 2016",
        "Sticker | pashaBiceps (Foil) | Cologne 2016",
        "Sticker | FaZe Clan (Foil) | Cologne 2016",
        "Sticker | Team Liquid (Foil) | Cologne 2016",
        "Sticker | Flipsid3 Tactics (Foil) | Cologne 2016",
        "Sticker | EliGE (Foil) | Cologne 2016",
        "Sticker | mousesports (Foil) | Cologne 2016",
        "Sticker | SmithZz (Foil) | Cologne 2016",
        "Sticker | Shara (Foil) | Cologne 2016",
        "Sticker | RUSH (Foil) | Cologne 2016",
        "Sticker | tarik (Foil) | Cologne 2016",
        "Sticker | coldzera (Foil) | Cologne 2016",
        "Sticker | karrigan (Foil) | Cologne 2016",
        "Sticker | daps (Foil) | Cologne 2016",
        "Sticker | hooch (Foil) | Cologne 2016",
        "Sticker | NAF (Foil) | Cologne 2016",
        "Sticker | olofmeister (Foil) | Cologne 2016",
        "Sticker | Dosia (Foil) | Cologne 2016",
        "Sticker | wayLander (Foil) | Cologne 2016",
        "Sticker | chrisJ (Foil) | Cologne 2016",
        "Sticker | aizy (Foil) | Cologne 2016",
        "Sticker | SK Gaming (Foil) | Cologne 2016",
        "Sticker | RpK (Foil) | Cologne 2016",
        "Sticker | jdm64 (Foil) | Cologne 2016",
        "Sticker | kioShiMa (Foil) | Cologne 2016",
        "Sticker | B1ad3 (Foil) | Cologne 2016",
        "Sticker | Hiko (Foil) | Cologne 2016",
        "Sticker | bodyy (Foil) | Cologne 2016",
        "Sticker | TACO (Foil) | Cologne 2016",
        "Sticker | Team EnVyUs (Foil) | Cologne 2016",
        "Sticker | dupreeh (Foil) | Cologne 2016",
        "Sticker | mixwell (Foil) | Cologne 2016",
        "Sticker | stanislaw (Foil) | Cologne 2016",
        "Sticker | G2 Esports (Foil) | Cologne 2016",
        "Sticker | MSL (Foil) | Cologne 2016",
        "Sticker | GuardiaN (Foil) | Cologne 2016",
        "Sticker | RUBINO (Foil) | Cologne 2016",
        "Sticker | nex (Foil) | Cologne 2016",
        "Sticker | NEO (Foil) | Cologne 2016",
        "Sticker | mou (Foil) | Cologne 2016",
        "Sticker | nitr0 (Foil) | Cologne 2016",
        "Sticker | denis (Foil) | Cologne 2016",
        "Sticker | GeT_RiGhT (Foil) | Cologne 2016",
        "Sticker | AdreN (Foil) | Cologne 2016",
        "Sticker | hazed (Foil) | Cologne 2016",
        "Sticker | Ninjas in Pyjamas (Foil) | Cologne 2016",
        "Sticker | reltuC (Foil) | Cologne 2016",
        "Sticker | JW (Foil) | Cologne 2016",
        "Sticker | cajunb (Foil) | Cologne 2016",
        "Sticker | pita (Foil) | Cologne 2016",
        "Sticker | k0nfig (Foil) | Cologne 2016",
        "Sticker | spaze (Foil) | Cologne 2016",
        "Sticker | Snax (Foil) | Cologne 2016",
        "Sticker | Virtus.Pro (Foil) | Cologne 2016",
        "Sticker | Gambit Gaming (Foil) | Cologne 2016",
        "Sticker | f0rest (Foil) | Cologne 2016",
        "Sticker | gla1ve (Foil) | Cologne 2016",
        "Sticker | Xyp9x (Foil) | Cologne 2016",
        "Sticker | koosta (Foil) | Cologne 2016",
        "Sticker | Zeus (Foil) | Cologne 2016",
        "Sticker | jkaem (Foil) | Cologne 2016",
        "Sticker | Natus Vincere (Foil) | Cologne 2016",
        "Sticker | Fnatic (Foil) | Cologne 2016",
        "Sticker | fer (Foil) | Cologne 2016",
        "Sticker | fnx (Foil) | Cologne 2016",
        "Sticker | flusha (Foil) | Cologne 2016",
        "Sticker | TaZ (Foil) | Cologne 2016",
        "Sticker | TENZKI (Foil) | Cologne 2016",
        "Sticker | ESL (Foil) | Cologne 2016",
        "Sticker | flamie (Foil) | Cologne 2016",
        "Sticker | Edward (Foil) | Cologne 2016",
        "Sticker | dennis (Foil) | Cologne 2016",
        "Sticker | byali (Foil) | Cologne 2016",
        "Sticker | KRIMZ (Foil) | Cologne 2016",
        "Sticker | friberg (Foil) | Cologne 2016",
        "Sticker | seized (Foil) | Cologne 2016",
        "Sticker | pyth (Foil) | Cologne 2016",
        "Sticker | Xizt (Foil) | Cologne 2016"
      ],
      "Paper": [
        "Sticker | tarik | Cologne 2016",
        "Sticker | ScreaM | Cologne 2016",
        "Sticker | Team Dignitas | Cologne 2016",
        "Sticker | NiKo | Cologne 2016",
        "Sticker | kennyS | Cologne 2016",
        "Sticker | s1mple | Cologne 2016",
        "Sticker | rain | Cologne 2016",
        "Sticker | device | Cologne 2016",
        "Sticker | mixwell | Cologne 2016",
        "Sticker | reltuC | Cologne 2016",
        "Sticker | fox | Cologne 2016",
        "Sticker | markeloff | Cologne 2016",
        "Sticker | MSL | Cologne 2016",
        "Sticker | spaze | Cologne 2016",
        "Sticker | RUSH | Cologne 2016",
        "Sticker | koosta | Cologne 2016",
        "Sticker | RUBINO | Cologne 2016",
        "Sticker | Counter Logic Gaming | Cologne 2016",
        "Sticker | Dosia | Cologne 2016",
        "Sticker | B1ad3 | Cologne 2016",
        "Sticker | shox | Cologne 2016",
        "Sticker | karrigan | Cologne 2016",
        "Sticker | Flipsid3 Tactics | Cologne 2016",
        "Sticker | wayLander | Cologne 2016",
        "Sticker | NAF | Cologne 2016",
        "Sticker | mou | Cologne 2016",
        "Sticker | k0nfig | Cologne 2016",
        "Sticker | mousesports | Cologne 2016",
        "Sticker | Happy | Cologne 2016",
        "Sticker | WorldEdit | Cologne 2016",
        "Sticker | hooch | Cologne 2016",
        "Sticker | hazed | Cologne 2016",
        "Sticker | pita | Cologne 2016",
        "Sticker | pashaBiceps | Cologne 2016",
        "Sticker | FalleN | Cologne 2016",
        "Sticker | Shara | Cologne 2016",
        "Sticker | apEX | Cologne 2016",
        "Sticker | OpTic Gaming | Cologne 2016",
        "Sticker | AdreN | Cologne 2016",
        "Sticker | TENZKI | Cologne 2016",
        "Sticker | Team Liquid | Cologne 2016",
        "Sticker | stanislaw | Cologne 2016",
        "Sticker | aizy | Cologne 2016",
        "Sticker | DEVIL | Cologne 2016",
        "Sticker | Astralis | Cologne 2016",
        "Sticker | daps | Cologne 2016",
        "Sticker | Spiidi | Cologne 2016",
        "Sticker | NBK- | Cologne 2016",
        "Sticker | cajunb | Cologne 2016",
        "Sticker | SmithZz | Cologne 2016",
        "Sticker | Team EnVyUs | Cologne 2016",
        "Sticker | gla1ve | Cologne 2016",
        "Sticker | FaZe Clan | Cologne 2016",
        "Sticker | GuardiaN | Cologne 2016",
        "Sticker | Xyp9x | Cologne 2016",
        "Sticker | dupreeh | Cologne 2016",
        "Sticker | Snax | Cologne 2016",
        "Sticker | G2 Esports | Cologne 2016",
        "Sticker | coldzera | Cologne 2016",
        "Sticker | Virtus.Pro | Cologne 2016",
        "Sticker | denis | Cologne 2016",
        "Sticker | RpK | Cologne 2016",
        "Sticker | bodyy | Cologne 2016",
        "Sticker | jkaem | Cologne 2016",
        "Sticker | Gambit Gaming | Cologne 2016",
        "Sticker | fer | Cologne 2016",
        "Sticker | SK Gaming | Cologne 2016",
        "Sticker | chrisJ | Cologne 2016",
        "Sticker | EliGE | Cologne 2016",
        "Sticker | byali | Cologne 2016",
        "Sticker | kioShiMa | Cologne 2016",
        "Sticker | Natus Vincere | Cologne 2016",
        "Sticker | GeT_RiGhT | Cologne 2016",
        "Sticker | NEO | Cologne 2016",
        "Sticker | Ninjas in Pyjamas | Cologne 2016",
        "Sticker | ESL | Cologne 2016",
        "Sticker | Zeus | Cologne 2016",
        "Sticker | seized | Cologne 2016",
        "Sticker | TACO | Cologne 2016",
        "Sticker | Fnatic | Cologne 2016",
        "Sticker | Edward | Cologne 2016",
        "Sticker | fnx | Cologne 2016",
        "Sticker | olofmeister | Cologne 2016",
        "Sticker | flamie | Cologne 2016",
        "Sticker | Hiko | Cologne 2016",
        "Sticker | f0rest | Cologne 2016",
        "Sticker | TaZ | Cologne 2016",
        "Sticker | jdm64 | Cologne 2016",
        "Sticker | friberg | Cologne 2016",
        "Sticker | Xizt | Cologne 2016",
        "Sticker | JW | Cologne 2016",
        "Sticker | nex | Cologne 2016",
        "Sticker | dennis | Cologne 2016",
        "Sticker | nitr0 | Cologne 2016",
        "Sticker | pyth | Cologne 2016",
        "Sticker | flusha | Cologne 2016",
        "Sticker | KRIMZ | Cologne 2016"
      ],
      "Gold": [
        "Sticker | TaZ (Gold) | Cologne 2016",
        "Sticker | Snax (Gold) | Cologne 2016",
        "Sticker | pashaBiceps (Gold) | Cologne 2016",
        "Sticker | NEO (Gold) | Cologne 2016",
        "Sticker | byali (Gold) | Cologne 2016",
        "Sticker | AdreN (Gold) | Cologne 2016",
        "Sticker | mou (Gold) | Cologne 2016",
        "Sticker | hooch (Gold) | Cologne 2016",
        "Sticker | Dosia (Gold) | Cologne 2016",
        "Sticker | spaze (Gold) | Cologne 2016",
        "Sticker | Xyp9x (Gold) | Cologne 2016",
        "Sticker | karrigan (Gold) | Cologne 2016",
        "Sticker | dupreeh (Gold) | Cologne 2016",
        "Sticker | device (Gold) | Cologne 2016",
        "Sticker | gla1ve (Gold) | Cologne 2016",
        "Sticker | SmithZz (Gold) | Cologne 2016",
        "Sticker | shox (Gold) | Cologne 2016",
        "Sticker | ScreaM (Gold) | Cologne 2016",
        "Sticker | RpK (Gold) | Cologne 2016",
        "Sticker | bodyy (Gold) | Cologne 2016",
        "Sticker | nitr0 (Gold) | Cologne 2016",
        "Sticker | Hiko (Gold) | Cologne 2016",
        "Sticker | s1mple (Gold) | Cologne 2016",
        "Sticker | EliGE (Gold) | Cologne 2016",
        "Sticker | jdm64 (Gold) | Cologne 2016",
        "Sticker | k0nfig (Gold) | Cologne 2016",
        "Sticker | RUBINO (Gold) | Cologne 2016",
        "Sticker | TENZKI (Gold) | Cologne 2016",
        "Sticker | MSL (Gold) | Cologne 2016",
        "Sticker | cajunb (Gold) | Cologne 2016",
        "Sticker | Xizt (Gold) | Cologne 2016",
        "Sticker | GeT_RiGhT (Gold) | Cologne 2016",
        "Sticker | friberg (Gold) | Cologne 2016",
        "Sticker | f0rest (Gold) | Cologne 2016",
        "Sticker | pyth (Gold) | Cologne 2016",
        "Sticker | Zeus (Gold) | Cologne 2016",
        "Sticker | seized (Gold) | Cologne 2016",
        "Sticker | GuardiaN (Gold) | Cologne 2016",
        "Sticker | flamie (Gold) | Cologne 2016",
        "Sticker | Edward (Gold) | Cologne 2016",
        "Sticker | NiKo (Gold) | Cologne 2016",
        "Sticker | nex (Gold) | Cologne 2016",
        "Sticker | Spiidi (Gold) | Cologne 2016",
        "Sticker | denis (Gold) | Cologne 2016",
        "Sticker | chrisJ (Gold) | Cologne 2016",
        "Sticker | TACO (Gold) | Cologne 2016",
        "Sticker | fnx (Gold) | Cologne 2016",
        "Sticker | fer (Gold) | Cologne 2016",
        "Sticker | FalleN (Gold) | Cologne 2016",
        "Sticker | coldzera (Gold) | Cologne 2016",
        "Sticker | jkaem (Gold) | Cologne 2016",
        "Sticker | rain (Gold) | Cologne 2016",
        "Sticker | kioShiMa (Gold) | Cologne 2016",
        "Sticker | fox (Gold) | Cologne 2016",
        "Sticker | aizy (Gold) | Cologne 2016",
        "Sticker | dennis (Gold) | Cologne 2016",
        "Sticker | olofmeister (Gold) | Cologne 2016",
        "Sticker | KRIMZ (Gold) | Cologne 2016",
        "Sticker | JW (Gold) | Cologne 2016",
        "Sticker | flusha (Gold) | Cologne 2016",
        "Sticker | WorldEdit (Gold) | Cologne 2016",
        "Sticker | markeloff (Gold) | Cologne 2016",
        "Sticker | Shara (Gold) | Cologne 2016",
        "Sticker | wayLander (Gold) | Cologne 2016",
        "Sticker | B1ad3 (Gold) | Cologne 2016",
        "Sticker | NBK- (Gold) | Cologne 2016",
        "Sticker | kennyS (Gold) | Cologne 2016",
        "Sticker | DEVIL (Gold) | Cologne 2016",
        "Sticker | Happy (Gold) | Cologne 2016",
        "Sticker | apEX (Gold) | Cologne 2016",
        "Sticker | stanislaw (Gold) | Cologne 2016",
        "Sticker | RUSH (Gold) | Cologne 2016",
        "Sticker | NAF (Gold) | Cologne 2016",
        "Sticker | mixwell (Gold) | Cologne 2016",
        "Sticker | daps (Gold) | Cologne 2016",
        "Sticker | tarik (Gold) | Cologne 2016",
        "Sticker | pita (Gold) | Cologne 2016",
        "Sticker | hazed (Gold) | Cologne 2016",
        "Sticker | koosta (Gold) | Cologne 2016",
        "Sticker | reltuC (Gold) | Cologne 2016",
        "Sticker | ESL (Gold) | Cologne 2016",
        "Sticker | Team Dignitas (Gold) | Cologne 2016",
        "Sticker | Fnatic (Gold) | Cologne 2016",
        "Sticker | Team EnVyUs (Gold) | Cologne 2016",
        "Sticker | Astralis (Gold) | Cologne 2016",
        "Sticker | FaZe Clan (Gold) | Cologne 2016",
        "Sticker | G2 Esports (Gold) | Cologne 2016",
        "Sticker | SK Gaming (Gold) | Cologne 2016",
        "Sticker | Virtus.Pro (Gold) | Cologne 2016",
        "Sticker | Natus Vincere (Gold) | Cologne 2016",
        "Sticker | mousesports (Gold) | Cologne 2016",
        "Sticker | Team Liquid (Gold) | Cologne 2016",
        "Sticker | Flipsid3 Tactics (Gold) | Cologne 2016",
        "Sticker | Gambit Gaming (Gold) | Cologne 2016",
        "Sticker | Counter Logic Gaming (Gold) | Cologne 2016",
        "Sticker | OpTic Gaming (Gold) | Cologne 2016",
        "Sticker | Ninjas in Pyjamas (Gold) | Cologne 2016"
      ]
    },
    "MLG Columbus 2016": {
      "Holo": [
        "Sticker | Luminosity Gaming (Holo) | MLG Columbus 2016",
        "Sticker | Counter Logic Gaming (Holo) | MLG Columbus 2016",
        "Sticker | Team Liquid (Holo) | MLG Columbus 2016",
        "Sticker | Cloud9 (Holo) | MLG Columbus 2016",
        "Sticker | mousesports (Holo) | MLG Columbus 2016",
        "Sticker | MLG (Holo) | MLG Columbus 2016",
        "Sticker | Splyce (Holo) | MLG Columbus 2016",
        "Sticker | FaZe Clan (Holo) | MLG Columbus 2016",
        "Sticker | Natus Vincere (Holo) | MLG Columbus 2016",
        "Sticker | Flipsid3 Tactics (Holo) | MLG Columbus 2016",
        "Sticker | G2 Esports (Holo) | MLG Columbus 2016",
        "Sticker | Ninjas in Pyjamas (Holo) | MLG Columbus 2016",
        "Sticker | Fnatic (Holo) | MLG Columbus 2016",
        "Sticker | Team EnVyUs (Holo) | MLG Columbus 2016",
        "Sticker | Virtus.Pro (Holo) | MLG Columbus 2016",
        "Sticker | Astralis (Holo) | MLG Columbus 2016",
        "Sticker | Gambit Gaming (Holo) | MLG Columbus 2016"
      ],
      "Foil": [
        "Sticker | s1mple (Foil) | MLG Columbus 2016",
        "Sticker | Stewie2K (Foil) | MLG Columbus 2016",
        "Sticker | shroud (Foil) | MLG Columbus 2016",
        "Sticker | MLG (Foil) | MLG Columbus 2016",
        "Sticker | NiKo (Foil) | MLG Columbus 2016",
        "Sticker | Skadoodle (Foil) | MLG Columbus 2016",
        "Sticker | ScreaM (Foil) | MLG Columbus 2016",
        "Sticker | rain (Foil) | MLG Columbus 2016",
        "Sticker | Luminosity Gaming (Foil) | MLG Columbus 2016",
        "Sticker | FalleN (Foil) | MLG Columbus 2016",
        "Sticker | kennyS (Foil) | MLG Columbus 2016",
        "Sticker | Counter Logic Gaming (Foil) | MLG Columbus 2016",
        "Sticker | G2 Esports (Foil) | MLG Columbus 2016",
        "Sticker | Cloud9 (Foil) | MLG Columbus 2016",
        "Sticker | Team Liquid (Foil) | MLG Columbus 2016",
        "Sticker | Flipsid3 Tactics (Foil) | MLG Columbus 2016",
        "Sticker | device (Foil) | MLG Columbus 2016",
        "Sticker | coldzera (Foil) | MLG Columbus 2016",
        "Sticker | Splyce (Foil) | MLG Columbus 2016",
        "Sticker | mousesports (Foil) | MLG Columbus 2016",
        "Sticker | EliGE (Foil) | MLG Columbus 2016",
        "Sticker | B1ad3 (Foil) | MLG Columbus 2016",
        "Sticker | freakazoid (Foil) | MLG Columbus 2016",
        "Sticker | FaZe Clan (Foil) | MLG Columbus 2016",
        "Sticker | Happy (Foil) | MLG Columbus 2016",
        "Sticker | TACO (Foil) | MLG Columbus 2016",
        "Sticker | Hiko (Foil) | MLG Columbus 2016",
        "Sticker | n0thing (Foil) | MLG Columbus 2016",
        "Sticker | pashaBiceps (Foil) | MLG Columbus 2016",
        "Sticker | Dosia (Foil) | MLG Columbus 2016",
        "Sticker | Ninjas in Pyjamas (Foil) | MLG Columbus 2016",
        "Sticker | Fnatic (Foil) | MLG Columbus 2016",
        "Sticker | Astralis (Foil) | MLG Columbus 2016",
        "Sticker | Team EnVyUs (Foil) | MLG Columbus 2016",
        "Sticker | shox (Foil) | MLG Columbus 2016",
        "Sticker | karrigan (Foil) | MLG Columbus 2016",
        "Sticker | Virtus.Pro (Foil) | MLG Columbus 2016",
        "Sticker | nitr0 (Foil) | MLG Columbus 2016",
        "Sticker | fox (Foil) | MLG Columbus 2016",
        "Sticker | Natus Vincere (Foil) | MLG Columbus 2016",
        "Sticker | fnx (Foil) | MLG Columbus 2016",
        "Sticker | adreN (Foil) | MLG Columbus 2016",
        "Sticker | tarik (Foil) | MLG Columbus 2016",
        "Sticker | apEX (Foil) | MLG Columbus 2016",
        "Sticker | Ex6TenZ (Foil) | MLG Columbus 2016",
        "Sticker | jdm64 (Foil) | MLG Columbus 2016",
        "Sticker | markeloff (Foil) | MLG Columbus 2016",
        "Sticker | Shara (Foil) | MLG Columbus 2016",
        "Sticker | jasonR (Foil) | MLG Columbus 2016",
        "Sticker | DAVEY (Foil) | MLG Columbus 2016",
        "Sticker | olofmeister (Foil) | MLG Columbus 2016",
        "Sticker | reltuC (Foil) | MLG Columbus 2016",
        "Sticker | JW (Foil) | MLG Columbus 2016",
        "Sticker | DEVIL (Foil) | MLG Columbus 2016",
        "Sticker | GuardiaN (Foil) | MLG Columbus 2016",
        "Sticker | RpK (Foil) | MLG Columbus 2016",
        "Sticker | fer (Foil) | MLG Columbus 2016",
        "Sticker | FugLy (Foil) | MLG Columbus 2016",
        "Sticker | flusha (Foil) | MLG Columbus 2016",
        "Sticker | bondik (Foil) | MLG Columbus 2016",
        "Sticker | jkaem (Foil) | MLG Columbus 2016",
        "Sticker | WorldEdit (Foil) | MLG Columbus 2016",
        "Sticker | chrisJ (Foil) | MLG Columbus 2016",
        "Sticker | AdreN (Foil) | MLG Columbus 2016",
        "Sticker | wayLander (Foil) | MLG Columbus 2016",
        "Sticker | Professor_Chaos (Foil) | MLG Columbus 2016",
        "Sticker | Maikelele (Foil) | MLG Columbus 2016",
        "Sticker | hazed (Foil) | MLG Columbus 2016",
        "Sticker | SmithZz (Foil) | MLG Columbus 2016",
        "Sticker | hooch (Foil) | MLG Columbus 2016",
        "Sticker | f0rest (Foil) | MLG Columbus 2016",
        "Sticker | nex (Foil) | MLG Columbus 2016",
        "Sticker | Snax (Foil) | MLG Columbus 2016",
        "Sticker | Xyp9x (Foil) | MLG Columbus 2016",
        "Sticker | GeT_RiGhT (Foil) | MLG Columbus 2016",
        "Sticker | NEO (Foil) | MLG Columbus 2016",
        "Sticker | mou (Foil) | MLG Columbus 2016",
        "Sticker | NBK- (Foil) | MLG Columbus 2016",
        "Sticker | byali (Foil) | MLG Columbus 2016",
        "Sticker | dennis (Foil) | MLG Columbus 2016",
        "Sticker | arya (Foil) | MLG Columbus 2016",
        "Sticker | dupreeh (Foil) | MLG Columbus 2016",
        "Sticker | Spiidi (Foil) | MLG Columbus 2016",
        "Sticker | denis (Foil) | MLG Columbus 2016",
        "Sticker | Gambit Gaming (Foil) | MLG Columbus 2016",
        "Sticker | KRIMZ (Foil) | MLG Columbus 2016",
        "Sticker | aizy (Foil) | MLG Columbus 2016",
        "Sticker | cajunb (Foil) | MLG Columbus 2016",
        "Sticker | abE (Foil) | MLG Columbus 2016",
        "Sticker | Zeus (Foil) | MLG Columbus 2016",
        "Sticker | TaZ (Foil) | MLG Columbus 2016",
        "Sticker | friberg (Foil) | MLG Columbus 2016",
        "Sticker | flamie (Foil) | MLG Columbus 2016",
        "Sticker | Xizt (Foil) | MLG Columbus 2016",
        "Sticker | pyth (Foil) | MLG Columbus 2016",
        "Sticker | Edward (Foil) | MLG Columbus 2016",
        "Sticker | seized (Foil) | MLG Columbus 2016"
      ],
      "Paper": [
        "Sticker | ScreaM | MLG Columbus 2016",
        "Sticker | Stewie2K | MLG Columbus 2016",
        "Sticker | shroud | MLG Columbus 2016",
        "Sticker | s1mple | MLG Columbus 2016",
        "Sticker | NiKo | MLG Columbus 2016",
        "Sticker | MLG | MLG Columbus 2016",
        "Sticker | kennyS | MLG Columbus 2016",
        "Sticker | FalleN | MLG Columbus 2016",
        "Sticker | Luminosity Gaming | MLG Columbus 2016",
        "Sticker | Flipsid3 Tactics | MLG Columbus 2016",
        "Sticker | Skadoodle | MLG Columbus 2016",
        "Sticker | rain | MLG Columbus 2016",
        "Sticker | markeloff | MLG Columbus 2016",
        "Sticker | jasonR | MLG Columbus 2016",
        "Sticker | bondik | MLG Columbus 2016",
        "Sticker | B1ad3 | MLG Columbus 2016",
        "Sticker | device | MLG Columbus 2016",
        "Sticker | Counter Logic Gaming | MLG Columbus 2016",
        "Sticker | hooch | MLG Columbus 2016",
        "Sticker | Shara | MLG Columbus 2016",
        "Sticker | Splyce | MLG Columbus 2016",
        "Sticker | Team Liquid | MLG Columbus 2016",
        "Sticker | shox | MLG Columbus 2016",
        "Sticker | DAVEY | MLG Columbus 2016",
        "Sticker | mousesports | MLG Columbus 2016",
        "Sticker | freakazoid | MLG Columbus 2016",
        "Sticker | n0thing | MLG Columbus 2016",
        "Sticker | pashaBiceps | MLG Columbus 2016",
        "Sticker | fox | MLG Columbus 2016",
        "Sticker | tarik | MLG Columbus 2016",
        "Sticker | G2 Esports | MLG Columbus 2016",
        "Sticker | Cloud9 | MLG Columbus 2016",
        "Sticker | Professor_Chaos | MLG Columbus 2016",
        "Sticker | DEVIL | MLG Columbus 2016",
        "Sticker | coldzera | MLG Columbus 2016",
        "Sticker | Happy | MLG Columbus 2016",
        "Sticker | Team EnVyUs | MLG Columbus 2016",
        "Sticker | AdreN | MLG Columbus 2016",
        "Sticker | mou | MLG Columbus 2016",
        "Sticker | Ex6TenZ | MLG Columbus 2016",
        "Sticker | WorldEdit | MLG Columbus 2016",
        "Sticker | fnx | MLG Columbus 2016",
        "Sticker | karrigan | MLG Columbus 2016",
        "Sticker | arya | MLG Columbus 2016",
        "Sticker | FugLy | MLG Columbus 2016",
        "Sticker | abE | MLG Columbus 2016",
        "Sticker | FaZe Clan | MLG Columbus 2016",
        "Sticker | Ninjas in Pyjamas | MLG Columbus 2016",
        "Sticker | apEX | MLG Columbus 2016",
        "Sticker | jdm64 | MLG Columbus 2016",
        "Sticker | wayLander | MLG Columbus 2016",
        "Sticker | SmithZz | MLG Columbus 2016",
        "Sticker | Maikelele | MLG Columbus 2016",
        "Sticker | Dosia | MLG Columbus 2016",
        "Sticker | Virtus.Pro | MLG Columbus 2016",
        "Sticker | EliGE | MLG Columbus 2016",
        "Sticker | NBK- | MLG Columbus 2016",
        "Sticker | Astralis | MLG Columbus 2016",
        "Sticker | hazed | MLG Columbus 2016",
        "Sticker | Snax | MLG Columbus 2016",
        "Sticker | reltuC | MLG Columbus 2016",
        "Sticker | denis | MLG Columbus 2016",
        "Sticker | GeT_RiGhT | MLG Columbus 2016",
        "Sticker | nex | MLG Columbus 2016",
        "Sticker | RpK | MLG Columbus 2016",
        "Sticker | Natus Vincere | MLG Columbus 2016",
        "Sticker | TACO | MLG Columbus 2016",
        "Sticker | Xyp9x | MLG Columbus 2016",
        "Sticker | Spiidi | MLG Columbus 2016",
        "Sticker | jkaem | MLG Columbus 2016",
        "Sticker | cajunb | MLG Columbus 2016",
        "Sticker | pyth | MLG Columbus 2016",
        "Sticker | fer | MLG Columbus 2016",
        "Sticker | NEO | MLG Columbus 2016",
        "Sticker | Hiko | MLG Columbus 2016",
        "Sticker | Gambit Gaming | MLG Columbus 2016",
        "Sticker | Fnatic | MLG Columbus 2016",
        "Sticker | dupreeh | MLG Columbus 2016",
        "Sticker | aizy | MLG Columbus 2016",
        "Sticker | olofmeister | MLG Columbus 2016",
        "Sticker | byali | MLG Columbus 2016",
        "Sticker | chrisJ | MLG Columbus 2016",
        "Sticker | TaZ | MLG Columbus 2016",
        "Sticker | f0rest | MLG Columbus 2016",
        "Sticker | friberg | MLG Columbus 2016",
        "Sticker | JW | MLG Columbus 2016",
        "Sticker | nitr0 | MLG Columbus 2016",
        "Sticker | Xizt | MLG Columbus 2016",
        "Sticker | adreN | MLG Columbus 2016",
        "Sticker | GuardiaN | MLG Columbus 2016",
        "Sticker | flusha | MLG Columbus 2016",
        "Sticker | Zeus | MLG Columbus 2016",
        "Sticker | dennis | MLG Columbus 2016",
        "Sticker | KRIMZ | MLG Columbus 2016",
        "Sticker | seized | MLG Columbus 2016",
        "Sticker | flamie | MLG Columbus 2016",
        "Sticker | Edward | MLG Columbus 2016"
      ],
      "Gold": [
        "Sticker | TaZ (Gold) | MLG Columbus 2016",
        "Sticker | Snax (Gold) | MLG Columbus 2016",
        "Sticker | pashaBiceps (Gold) | MLG Columbus 2016",
        "Sticker | NEO (Gold) | MLG Columbus 2016",
        "Sticker | byali (Gold) | MLG Columbus 2016",
        "Sticker | AdreN (Gold) | MLG Columbus 2016",
        "Sticker | mou (Gold) | MLG Columbus 2016",
        "Sticker | hooch (Gold) | MLG Columbus 2016",
        "Sticker | Dosia (Gold) | MLG Columbus 2016",
        "Sticker | wayLander (Gold) | MLG Columbus 2016",
        "Sticker | Xyp9x (Gold) | MLG Columbus 2016",
        "Sticker | karrigan (Gold) | MLG Columbus 2016",
        "Sticker | dupreeh (Gold) | MLG Columbus 2016",
        "Sticker | device (Gold) | MLG Columbus 2016",
        "Sticker | cajunb (Gold) | MLG Columbus 2016",
        "Sticker | SmithZz (Gold) | MLG Columbus 2016",
        "Sticker | shox (Gold) | MLG Columbus 2016",
        "Sticker | ScreaM (Gold) | MLG Columbus 2016",
        "Sticker | RpK (Gold) | MLG Columbus 2016",
        "Sticker | Ex6TenZ (Gold) | MLG Columbus 2016",
        "Sticker | nitr0 (Gold) | MLG Columbus 2016",
        "Sticker | Hiko (Gold) | MLG Columbus 2016",
        "Sticker | s1mple (Gold) | MLG Columbus 2016",
        "Sticker | EliGE (Gold) | MLG Columbus 2016",
        "Sticker | adreN (Gold) | MLG Columbus 2016",
        "Sticker | abE (Gold) | MLG Columbus 2016",
        "Sticker | DAVEY (Gold) | MLG Columbus 2016",
        "Sticker | Professor_Chaos (Gold) | MLG Columbus 2016",
        "Sticker | arya (Gold) | MLG Columbus 2016",
        "Sticker | jasonR (Gold) | MLG Columbus 2016",
        "Sticker | Xizt (Gold) | MLG Columbus 2016",
        "Sticker | GeT_RiGhT (Gold) | MLG Columbus 2016",
        "Sticker | friberg (Gold) | MLG Columbus 2016",
        "Sticker | f0rest (Gold) | MLG Columbus 2016",
        "Sticker | pyth (Gold) | MLG Columbus 2016",
        "Sticker | Zeus (Gold) | MLG Columbus 2016",
        "Sticker | seized (Gold) | MLG Columbus 2016",
        "Sticker | GuardiaN (Gold) | MLG Columbus 2016",
        "Sticker | flamie (Gold) | MLG Columbus 2016",
        "Sticker | Edward (Gold) | MLG Columbus 2016",
        "Sticker | NiKo (Gold) | MLG Columbus 2016",
        "Sticker | nex (Gold) | MLG Columbus 2016",
        "Sticker | Spiidi (Gold) | MLG Columbus 2016",
        "Sticker | denis (Gold) | MLG Columbus 2016",
        "Sticker | chrisJ (Gold) | MLG Columbus 2016",
        "Sticker | TACO (Gold) | MLG Columbus 2016",
        "Sticker | fer (Gold) | MLG Columbus 2016",
        "Sticker | FalleN (Gold) | MLG Columbus 2016",
        "Sticker | coldzera (Gold) | MLG Columbus 2016",
        "Sticker | fnx (Gold) | MLG Columbus 2016",
        "Sticker | jkaem (Gold) | MLG Columbus 2016",
        "Sticker | rain (Gold) | MLG Columbus 2016",
        "Sticker | Maikelele (Gold) | MLG Columbus 2016",
        "Sticker | fox (Gold) | MLG Columbus 2016",
        "Sticker | aizy (Gold) | MLG Columbus 2016",
        "Sticker | dennis (Gold) | MLG Columbus 2016",
        "Sticker | olofmeister (Gold) | MLG Columbus 2016",
        "Sticker | KRIMZ (Gold) | MLG Columbus 2016",
        "Sticker | JW (Gold) | MLG Columbus 2016",
        "Sticker | flusha (Gold) | MLG Columbus 2016",
        "Sticker | WorldEdit (Gold) | MLG Columbus 2016",
        "Sticker | markeloff (Gold) | MLG Columbus 2016",
        "Sticker | Shara (Gold) | MLG Columbus 2016",
        "Sticker | bondik (Gold) | MLG Columbus 2016",
        "Sticker | B1ad3 (Gold) | MLG Columbus 2016",
        "Sticker | NBK- (Gold) | MLG Columbus 2016",
        "Sticker | kennyS (Gold) | MLG Columbus 2016",
        "Sticker | DEVIL (Gold) | MLG Columbus 2016",
        "Sticker | Happy (Gold) | MLG Columbus 2016",
        "Sticker | apEX (Gold) | MLG Columbus 2016",
        "Sticker | n0thing (Gold) | MLG Columbus 2016",
        "Sticker | Skadoodle (Gold) | MLG Columbus 2016",
        "Sticker | shroud (Gold) | MLG Columbus 2016",
        "Sticker | Stewie2K (Gold) | MLG Columbus 2016",
        "Sticker | freakazoid (Gold) | MLG Columbus 2016",
        "Sticker | tarik (Gold) | MLG Columbus 2016",
        "Sticker | jdm64 (Gold) | MLG Columbus 2016",
        "Sticker | hazed (Gold) | MLG Columbus 2016",
        "Sticker | FugLy (Gold) | MLG Columbus 2016",
        "Sticker | reltuC (Gold) | MLG Columbus 2016",
        "Sticker | MLG (Gold) | MLG Columbus 2016",
        "Sticker | Luminosity Gaming (Gold) | MLG Columbus 2016",
        "Sticker | Fnatic (Gold) | MLG Columbus 2016",
        "Sticker | Team EnVyUs (Gold) | MLG Columbus 2016",
        "Sticker | Astralis (Gold) | MLG Columbus 2016",
        "Sticker | FaZe Clan (Gold) | MLG Columbus 2016",
        "Sticker | G2 Esports (Gold) | MLG Columbus 2016",
        "Sticker | Cloud9 (Gold) | MLG Columbus 2016",
        "Sticker | Virtus.Pro (Gold) | MLG Columbus 2016",
        "Sticker | Natus Vincere (Gold) | MLG Columbus 2016",
        "Sticker | mousesports (Gold) | MLG Columbus 2016",
        "Sticker | Team Liquid (Gold) | MLG Columbus 2016",
        "Sticker | Flipsid3 Tactics (Gold) | MLG Columbus 2016",
        "Sticker | Gambit Gaming (Gold) | MLG Columbus 2016",
        "Sticker | Counter Logic Gaming (Gold) | MLG Columbus 2016",
        "Sticker | Splyce (Gold) | MLG Columbus 2016",
        "Sticker | Ninjas in Pyjamas (Gold) | MLG Columbus 2016"
      ]
    },
    "Cologne 2015": {
      "Foil": [
        "Sticker | Titan (Foil) | Cologne 2015",
        "Sticker | shroud (Foil) | Cologne 2015",
        "Sticker | ScreaM (Foil) | Cologne 2015",
        "Sticker | kennyS (Foil) | Cologne 2015",
        "Sticker | FalleN (Foil) | Cologne 2015",
        "Sticker | pashaBiceps (Foil) | Cologne 2015",
        "Sticker | shox (Foil) | Cologne 2015",
        "Sticker | James (Foil) | Cologne 2015",
        "Sticker | jks (Foil) | Cologne 2015",
        "Sticker | Team Kinguin (Foil) | Cologne 2015",
        "Sticker | Skadoodle (Foil) | Cologne 2015",
        "Sticker | mousesports (Foil) | Cologne 2015",
        "Sticker | device (Foil) | Cologne 2015",
        "Sticker | Luminosity Gaming (Foil) | Cologne 2015",
        "Sticker | n0thing (Foil) | Cologne 2015",
        "Sticker | rain (Foil) | Cologne 2015",
        "Sticker | Flipsid3 Tactics (Foil) | Cologne 2015",
        "Sticker | RpK (Foil) | Cologne 2015",
        "Sticker | karrigan (Foil) | Cologne 2015",
        "Sticker | Counter Logic Gaming (Foil) | Cologne 2015",
        "Sticker | SmithZz (Foil) | Cologne 2015",
        "Sticker | Maniac (Foil) | Cologne 2015",
        "Sticker | Cloud9 G2A (Foil) | Cologne 2015",
        "Sticker | Hyper (Foil) | Cologne 2015",
        "Sticker | olofmeister (Foil) | Cologne 2015",
        "Sticker | coldzera (Foil) | Cologne 2015",
        "Sticker | Ex6TenZ (Foil) | Cologne 2015",
        "Sticker | freakazoid (Foil) | Cologne 2015",
        "Sticker | Happy (Foil) | Cologne 2015",
        "Sticker | Team Immunity (Foil) | Cologne 2015",
        "Sticker | markeloff (Foil) | Cologne 2015",
        "Sticker | tarik (Foil) | Cologne 2015",
        "Sticker | SPUNJ (Foil) | Cologne 2015",
        "Sticker | Team EnVyUs (Foil) | Cologne 2015",
        "Sticker | Edward (Foil) | Cologne 2015",
        "Sticker | WorldEdit (Foil) | Cologne 2015",
        "Sticker | JW (Foil) | Cologne 2015",
        "Sticker | Snax (Foil) | Cologne 2015",
        "Sticker | GeT_RiGhT (Foil) | Cologne 2015",
        "Sticker | fox (Foil) | Cologne 2015",
        "Sticker | Fnatic (Foil) | Cologne 2015",
        "Sticker | f0rest (Foil) | Cologne 2015",
        "Sticker | NEO (Foil) | Cologne 2015",
        "Sticker | GuardiaN (Foil) | Cologne 2015",
        "Sticker | Ninjas in Pyjamas (Foil) | Cologne 2015",
        "Sticker | apEX (Foil) | Cologne 2015",
        "Sticker | Maikelele (Foil) | Cologne 2015",
        "Sticker | jdm64 (Foil) | Cologne 2015",
        "Sticker | denis (Foil) | Cologne 2015",
        "Sticker | steel (Foil) | Cologne 2015",
        "Sticker | Team SoloMid (Foil) | Cologne 2015",
        "Sticker | Natus Vincere (Foil) | Cologne 2015",
        "Sticker | SnypeR (Foil) | Cologne 2015",
        "Sticker | B1ad3 (Foil) | Cologne 2015",
        "Sticker | FNS (Foil) | Cologne 2015",
        "Sticker | Havoc (Foil) | Cologne 2015",
        "Sticker | seang@res (Foil) | Cologne 2015",
        "Sticker | Virtus.Pro (Foil) | Cologne 2015",
        "Sticker | dupreeh (Foil) | Cologne 2015",
        "Sticker | gob b (Foil) | Cologne 2015",
        "Sticker | fer (Foil) | Cologne 2015",
        "Sticker | flusha (Foil) | Cologne 2015",
        "Sticker | emagine (Foil) | Cologne 2015",
        "Sticker | dennis (Foil) | Cologne 2015",
        "Sticker | chrisJ (Foil) | Cologne 2015",
        "Sticker | boltz (Foil) | Cologne 2015",
        "Sticker | reltuC (Foil) | Cologne 2015",
        "Sticker | friberg (Foil) | Cologne 2015",
        "Sticker | bondik (Foil) | Cologne 2015",
        "Sticker | GruBy (Foil) | Cologne 2015",
        "Sticker | nex (Foil) | Cologne 2015",
        "Sticker | Spiidi (Foil) | Cologne 2015",
        "Sticker | NBK- (Foil) | Cologne 2015",
        "Sticker | kioShiMa (Foil) | Cologne 2015",
        "Sticker | Zeus (Foil) | Cologne 2015",
        "Sticker | Xizt (Foil) | Cologne 2015",
        "Sticker | seized (Foil) | Cologne 2015",
        "Sticker | DavCost (Foil) | Cologne 2015",
        "Sticker | flamie (Foil) | Cologne 2015",
        "Sticker | Renegades (Foil) | Cologne 2015",
        "Sticker | Team eBettle (Foil) | Cologne 2015",
        "Sticker | yam (Foil) | Cologne 2015",
        "Sticker | KRIMZ (Foil) | Cologne 2015",
        "Sticker | peet (Foil) | Cologne 2015",
        "Sticker | rallen (Foil) | Cologne 2015",
        "Sticker | AZR (Foil) | Cologne 2015",
        "Sticker | hazed (Foil) | Cologne 2015",
        "Sticker | ESL (Foil) | Cologne 2015",
        "Sticker | allu (Foil) | Cologne 2015",
        "Sticker | TaZ (Foil) | Cologne 2015",
        "Sticker | byali (Foil) | Cologne 2015",
        "Sticker | Rickeh (Foil) | Cologne 2015",
        "Sticker | Furlan (Foil) | Cologne 2015",
        "Sticker | USTILO (Foil) | Cologne 2015",
        "Sticker | pronax (Foil) | Cologne 2015",
        "Sticker | Xyp9x (Foil) | Cologne 2015",
        "Sticker | cajunb (Foil) | Cologne 2015"
      ],
      "Paper": [
        "Sticker | Titan | Cologne 2015",
        "Sticker | James | Cologne 2015",
        "Sticker | FalleN | Cologne 2015",
        "Sticker | shox | Cologne 2015",
        "Sticker | ScreaM | Cologne 2015",
        "Sticker | WorldEdit | Cologne 2015",
        "Sticker | Hyper | Cologne 2015",
        "Sticker | markeloff | Cologne 2015",
        "Sticker | shroud | Cologne 2015",
        "Sticker | Maniac | Cologne 2015",
        "Sticker | B1ad3 | Cologne 2015",
        "Sticker | jks | Cologne 2015",
        "Sticker | pashaBiceps | Cologne 2015",
        "Sticker | SmithZz | Cologne 2015",
        "Sticker | kennyS | Cologne 2015",
        "Sticker | Ex6TenZ | Cologne 2015",
        "Sticker | coldzera | Cologne 2015",
        "Sticker | emagine | Cologne 2015",
        "Sticker | Luminosity Gaming | Cologne 2015",
        "Sticker | USTILO | Cologne 2015",
        "Sticker | GruBy | Cologne 2015",
        "Sticker | Flipsid3 Tactics | Cologne 2015",
        "Sticker | SnypeR | Cologne 2015",
        "Sticker | RpK | Cologne 2015",
        "Sticker | reltuC | Cologne 2015",
        "Sticker | Rickeh | Cologne 2015",
        "Sticker | fer | Cologne 2015",
        "Sticker | bondik | Cologne 2015",
        "Sticker | peet | Cologne 2015",
        "Sticker | chrisJ | Cologne 2015",
        "Sticker | Skadoodle | Cologne 2015",
        "Sticker | rain | Cologne 2015",
        "Sticker | Team Immunity | Cologne 2015",
        "Sticker | Counter Logic Gaming | Cologne 2015",
        "Sticker | Furlan | Cologne 2015",
        "Sticker | FNS | Cologne 2015",
        "Sticker | device | Cologne 2015",
        "Sticker | SPUNJ | Cologne 2015",
        "Sticker | Havoc | Cologne 2015",
        "Sticker | mousesports | Cologne 2015",
        "Sticker | boltz | Cologne 2015",
        "Sticker | steel | Cologne 2015",
        "Sticker | DavCost | Cologne 2015",
        "Sticker | rallen | Cologne 2015",
        "Sticker | tarik | Cologne 2015",
        "Sticker | yam | Cologne 2015",
        "Sticker | Team eBettle | Cologne 2015",
        "Sticker | jdm64 | Cologne 2015",
        "Sticker | Team Kinguin | Cologne 2015",
        "Sticker | Edward | Cologne 2015",
        "Sticker | ESL | Cologne 2015",
        "Sticker | hazed | Cologne 2015",
        "Sticker | gob b | Cologne 2015",
        "Sticker | karrigan | Cologne 2015",
        "Sticker | fox | Cologne 2015",
        "Sticker | denis | Cologne 2015",
        "Sticker | Cloud9 G2A | Cologne 2015",
        "Sticker | Snax | Cologne 2015",
        "Sticker | AZR | Cologne 2015",
        "Sticker | GuardiaN | Cologne 2015",
        "Sticker | Natus Vincere | Cologne 2015",
        "Sticker | Spiidi | Cologne 2015",
        "Sticker | freakazoid | Cologne 2015",
        "Sticker | Team EnVyUs | Cologne 2015",
        "Sticker | apEX | Cologne 2015",
        "Sticker | Virtus.Pro | Cologne 2015",
        "Sticker | n0thing | Cologne 2015",
        "Sticker | Ninjas in Pyjamas | Cologne 2015",
        "Sticker | Happy | Cologne 2015",
        "Sticker | nex | Cologne 2015",
        "Sticker | Zeus | Cologne 2015",
        "Sticker | Fnatic | Cologne 2015",
        "Sticker | olofmeister | Cologne 2015",
        "Sticker | Maikelele | Cologne 2015",
        "Sticker | NEO | Cologne 2015",
        "Sticker | f0rest | Cologne 2015",
        "Sticker | GeT_RiGhT | Cologne 2015",
        "Sticker | seang@res | Cologne 2015",
        "Sticker | byali | Cologne 2015",
        "Sticker | seized | Cologne 2015",
        "Sticker | JW | Cologne 2015",
        "Sticker | NBK- | Cologne 2015",
        "Sticker | Renegades | Cologne 2015",
        "Sticker | dupreeh | Cologne 2015",
        "Sticker | dennis | Cologne 2015",
        "Sticker | TaZ | Cologne 2015",
        "Sticker | kioShiMa | Cologne 2015",
        "Sticker | flusha | Cologne 2015",
        "Sticker | friberg | Cologne 2015",
        "Sticker | Xyp9x | Cologne 2015",
        "Sticker | Team SoloMid | Cologne 2015",
        "Sticker | cajunb | Cologne 2015",
        "Sticker | KRIMZ | Cologne 2015",
        "Sticker | allu | Cologne 2015",
        "Sticker | flamie | Cologne 2015",
        "Sticker | Xizt | Cologne 2015",
        "Sticker | pronax | Cologne 2015"
      ],
      "Gold": [
        "Sticker | ESL (Gold) | Cologne 2015",
        "Sticker | Counter Logic Gaming (Gold) | Cologne 2015",
        "Sticker | Titan (Gold) | Cologne 2015",
        "Sticker | Flipsid3 Tactics (Gold) | Cologne 2015",
        "Sticker | Team Immunity (Gold) | Cologne 2015",
        "Sticker | Team SoloMid (Gold) | Cologne 2015",
        "Sticker | Luminosity Gaming (Gold) | Cologne 2015",
        "Sticker | Team EnVyUs (Gold) | Cologne 2015",
        "Sticker | Ninjas in Pyjamas (Gold) | Cologne 2015",
        "Sticker | Cloud9 G2A (Gold) | Cologne 2015",
        "Sticker | Team eBettle (Gold) | Cologne 2015",
        "Sticker | Team Kinguin (Gold) | Cologne 2015",
        "Sticker | Renegades (Gold) | Cologne 2015",
        "Sticker | Natus Vincere (Gold) | Cologne 2015",
        "Sticker | mousesports (Gold) | Cologne 2015",
        "Sticker | Virtus.Pro (Gold) | Cologne 2015",
        "Sticker | Fnatic (Gold) | Cologne 2015",
        "Sticker | Skadoodle (Gold) | Cologne 2015",
        "Sticker | freakazoid (Gold) | Cologne 2015",
        "Sticker | shroud (Gold) | Cologne 2015",
        "Sticker | seang@res (Gold) | Cologne 2015",
        "Sticker | n0thing (Gold) | Cologne 2015",
        "Sticker | tarik (Gold) | Cologne 2015",
        "Sticker | reltuC (Gold) | Cologne 2015",
        "Sticker | jdm64 (Gold) | Cologne 2015",
        "Sticker | FNS (Gold) | Cologne 2015",
        "Sticker | hazed (Gold) | Cologne 2015",
        "Sticker | RpK (Gold) | Cologne 2015",
        "Sticker | SmithZz (Gold) | Cologne 2015",
        "Sticker | shox (Gold) | Cologne 2015",
        "Sticker | Ex6TenZ (Gold) | Cologne 2015",
        "Sticker | Maniac (Gold) | Cologne 2015",
        "Sticker | GruBy (Gold) | Cologne 2015",
        "Sticker | Furlan (Gold) | Cologne 2015",
        "Sticker | peet (Gold) | Cologne 2015",
        "Sticker | Hyper (Gold) | Cologne 2015",
        "Sticker | rallen (Gold) | Cologne 2015",
        "Sticker | fox (Gold) | Cologne 2015",
        "Sticker | Maikelele (Gold) | Cologne 2015",
        "Sticker | rain (Gold) | Cologne 2015",
        "Sticker | ScreaM (Gold) | Cologne 2015",
        "Sticker | dennis (Gold) | Cologne 2015",
        "Sticker | DavCost (Gold) | Cologne 2015",
        "Sticker | WorldEdit (Gold) | Cologne 2015",
        "Sticker | bondik (Gold) | Cologne 2015",
        "Sticker | B1ad3 (Gold) | Cologne 2015",
        "Sticker | markeloff (Gold) | Cologne 2015",
        "Sticker | James (Gold) | Cologne 2015",
        "Sticker | SnypeR (Gold) | Cologne 2015",
        "Sticker | emagine (Gold) | Cologne 2015",
        "Sticker | Rickeh (Gold) | Cologne 2015",
        "Sticker | USTILO (Gold) | Cologne 2015",
        "Sticker | yam (Gold) | Cologne 2015",
        "Sticker | SPUNJ (Gold) | Cologne 2015",
        "Sticker | jks (Gold) | Cologne 2015",
        "Sticker | Havoc (Gold) | Cologne 2015",
        "Sticker | AZR (Gold) | Cologne 2015",
        "Sticker | Spiidi (Gold) | Cologne 2015",
        "Sticker | nex (Gold) | Cologne 2015",
        "Sticker | denis (Gold) | Cologne 2015",
        "Sticker | gob b (Gold) | Cologne 2015",
        "Sticker | chrisJ (Gold) | Cologne 2015",
        "Sticker | byali (Gold) | Cologne 2015",
        "Sticker | Snax (Gold) | Cologne 2015",
        "Sticker | TaZ (Gold) | Cologne 2015",
        "Sticker | pashaBiceps (Gold) | Cologne 2015",
        "Sticker | NEO (Gold) | Cologne 2015",
        "Sticker | cajunb (Gold) | Cologne 2015",
        "Sticker | Xyp9x (Gold) | Cologne 2015",
        "Sticker | dupreeh (Gold) | Cologne 2015",
        "Sticker | device (Gold) | Cologne 2015",
        "Sticker | karrigan (Gold) | Cologne 2015",
        "Sticker | NBK- (Gold) | Cologne 2015",
        "Sticker | apEX (Gold) | Cologne 2015",
        "Sticker | Happy (Gold) | Cologne 2015",
        "Sticker | kioShiMa (Gold) | Cologne 2015",
        "Sticker | kennyS (Gold) | Cologne 2015",
        "Sticker | allu (Gold) | Cologne 2015",
        "Sticker | friberg (Gold) | Cologne 2015",
        "Sticker | GeT_RiGhT (Gold) | Cologne 2015",
        "Sticker | f0rest (Gold) | Cologne 2015",
        "Sticker | Xizt (Gold) | Cologne 2015",
        "Sticker | flamie (Gold) | Cologne 2015",
        "Sticker | Edward (Gold) | Cologne 2015",
        "Sticker | seized (Gold) | Cologne 2015",
        "Sticker | Zeus (Gold) | Cologne 2015",
        "Sticker | GuardiaN (Gold) | Cologne 2015",
        "Sticker | coldzera (Gold) | Cologne 2015",
        "Sticker | boltz (Gold) | Cologne 2015",
        "Sticker | fer (Gold) | Cologne 2015",
        "Sticker | steel (Gold) | Cologne 2015",
        "Sticker | FalleN (Gold) | Cologne 2015",
        "Sticker | olofmeister (Gold) | Cologne 2015",
        "Sticker | KRIMZ (Gold) | Cologne 2015",
        "Sticker | JW (Gold) | Cologne 2015",
        "Sticker | flusha (Gold) | Cologne 2015",
        "Sticker | pronax (Gold) | Cologne 2015"
      ]
    },
    "Cluj-Napoca 2015": {
      "Foil": [
        "Sticker | ScreaM (Foil) | Cluj-Napoca 2015",
        "Sticker | NiKo (Foil) | Cluj-Napoca 2015",
        "Sticker | Titan (Foil) | Cluj-Napoca 2015",
        "Sticker | Hyper (Foil) | Cluj-Napoca 2015",
        "Sticker | shroud (Foil) | Cluj-Napoca 2015",
        "Sticker | Team Dignitas (Foil) | Cluj-Napoca 2015",
        "Sticker | Pimp (Foil) | Cluj-Napoca 2015",
        "Sticker | Ex6TenZ (Foil) | Cluj-Napoca 2015",
        "Sticker | kennyS (Foil) | Cluj-Napoca 2015",
        "Sticker | n0thing (Foil) | Cluj-Napoca 2015",
        "Sticker | shox (Foil) | Cluj-Napoca 2015",
        "Sticker | Skadoodle (Foil) | Cluj-Napoca 2015",
        "Sticker | pashaBiceps (Foil) | Cluj-Napoca 2015",
        "Sticker | GruBy (Foil) | Cluj-Napoca 2015",
        "Sticker | RpK (Foil) | Cluj-Napoca 2015",
        "Sticker | rain (Foil) | Cluj-Napoca 2015",
        "Sticker | SmithZz (Foil) | Cluj-Napoca 2015",
        "Sticker | EliGE (Foil) | Cluj-Napoca 2015",
        "Sticker | mousesports (Foil) | Cluj-Napoca 2015",
        "Sticker | chrisJ (Foil) | Cluj-Napoca 2015",
        "Sticker | FalleN (Foil) | Cluj-Napoca 2015",
        "Sticker | Kjaerbye (Foil) | Cluj-Napoca 2015",
        "Sticker | B1ad3 (Foil) | Cluj-Napoca 2015",
        "Sticker | tenzki (Foil) | Cluj-Napoca 2015",
        "Sticker | tarik (Foil) | Cluj-Napoca 2015",
        "Sticker | MSL (Foil) | Cluj-Napoca 2015",
        "Sticker | Cloud9 (Foil) | Cluj-Napoca 2015",
        "Sticker | freakazoid (Foil) | Cluj-Napoca 2015",
        "Sticker | WorldEdit (Foil) | Cluj-Napoca 2015",
        "Sticker | markeloff (Foil) | Cluj-Napoca 2015",
        "Sticker | gob b (Foil) | Cluj-Napoca 2015",
        "Sticker | GeT_RiGhT (Foil) | Cluj-Napoca 2015",
        "Sticker | aizy (Foil) | Cluj-Napoca 2015",
        "Sticker | peet (Foil) | Cluj-Napoca 2015",
        "Sticker | device (Foil) | Cluj-Napoca 2015",
        "Sticker | Hiko (Foil) | Cluj-Napoca 2015",
        "Sticker | f0rest (Foil) | Cluj-Napoca 2015",
        "Sticker | apEX (Foil) | Cluj-Napoca 2015",
        "Sticker | Flipsid3 Tactics (Foil) | Cluj-Napoca 2015",
        "Sticker | Luminosity Gaming (Foil) | Cluj-Napoca 2015",
        "Sticker | bondik (Foil) | Cluj-Napoca 2015",
        "Sticker | jdm64 (Foil) | Cluj-Napoca 2015",
        "Sticker | Counter Logic Gaming (Foil) | Cluj-Napoca 2015",
        "Sticker | karrigan (Foil) | Cluj-Napoca 2015",
        "Sticker | Team Liquid (Foil) | Cluj-Napoca 2015",
        "Sticker | GuardiaN (Foil) | Cluj-Napoca 2015",
        "Sticker | denis (Foil) | Cluj-Napoca 2015",
        "Sticker | nex (Foil) | Cluj-Napoca 2015",
        "Sticker | Vexed Gaming (Foil) | Cluj-Napoca 2015",
        "Sticker | olofmeister (Foil) | Cluj-Napoca 2015",
        "Sticker | seang@res (Foil) | Cluj-Napoca 2015",
        "Sticker | Happy (Foil) | Cluj-Napoca 2015",
        "Sticker | coldzera (Foil) | Cluj-Napoca 2015",
        "Sticker | NEO (Foil) | Cluj-Napoca 2015",
        "Sticker | DreamHack (Foil) | Cluj-Napoca 2015",
        "Sticker | NBK- (Foil) | Cluj-Napoca 2015",
        "Sticker | rallen (Foil) | Cluj-Napoca 2015",
        "Sticker | adreN (Foil) | Cluj-Napoca 2015",
        "Sticker | Furlan (Foil) | Cluj-Napoca 2015",
        "Sticker | friberg (Foil) | Cluj-Napoca 2015",
        "Sticker | DavCost (Foil) | Cluj-Napoca 2015",
        "Sticker | fox (Foil) | Cluj-Napoca 2015",
        "Sticker | FugLy (Foil) | Cluj-Napoca 2015",
        "Sticker | G2 Esports (Foil) | Cluj-Napoca 2015",
        "Sticker | reltuC (Foil) | Cluj-Napoca 2015",
        "Sticker | nitr0 (Foil) | Cluj-Napoca 2015",
        "Sticker | fer (Foil) | Cluj-Napoca 2015",
        "Sticker | FNS (Foil) | Cluj-Napoca 2015",
        "Sticker | kioShiMa (Foil) | Cluj-Napoca 2015",
        "Sticker | KRIMZ (Foil) | Cluj-Napoca 2015",
        "Sticker | dennis (Foil) | Cluj-Napoca 2015",
        "Sticker | JW (Foil) | Cluj-Napoca 2015",
        "Sticker | Maikelele (Foil) | Cluj-Napoca 2015",
        "Sticker | flusha (Foil) | Cluj-Napoca 2015",
        "Sticker | Snax (Foil) | Cluj-Napoca 2015",
        "Sticker | hazed (Foil) | Cluj-Napoca 2015",
        "Sticker | Team EnVyUs (Foil) | Cluj-Napoca 2015",
        "Sticker | dupreeh (Foil) | Cluj-Napoca 2015",
        "Sticker | seized (Foil) | Cluj-Napoca 2015",
        "Sticker | boltz (Foil) | Cluj-Napoca 2015",
        "Sticker | Edward (Foil) | Cluj-Napoca 2015",
        "Sticker | jkaem (Foil) | Cluj-Napoca 2015",
        "Sticker | flamie (Foil) | Cluj-Napoca 2015",
        "Sticker | steel (Foil) | Cluj-Napoca 2015",
        "Sticker | allu (Foil) | Cluj-Napoca 2015",
        "Sticker | Ninjas in Pyjamas (Foil) | Cluj-Napoca 2015",
        "Sticker | Zeus (Foil) | Cluj-Napoca 2015",
        "Sticker | Virtus.Pro (Foil) | Cluj-Napoca 2015",
        "Sticker | byali (Foil) | Cluj-Napoca 2015",
        "Sticker | cajunb (Foil) | Cluj-Napoca 2015",
        "Sticker | TaZ (Foil) | Cluj-Napoca 2015",
        "Sticker | Fnatic (Foil) | Cluj-Napoca 2015",
        "Sticker | Natus Vincere (Foil) | Cluj-Napoca 2015",
        "Sticker | Xizt (Foil) | Cluj-Napoca 2015",
        "Sticker | pronax (Foil) | Cluj-Napoca 2015",
        "Sticker | Xyp9x (Foil) | Cluj-Napoca 2015",
        "Sticker | Team SoloMid (Foil) | Cluj-Napoca 2015"
      ],
      "Paper": [
        "Sticker | NiKo | Cluj-Napoca 2015",
        "Sticker | Pimp | Cluj-Napoca 2015",
        "Sticker | Titan | Cluj-Napoca 2015",
        "Sticker | aizy | Cluj-Napoca 2015",
        "Sticker | Team Dignitas | Cluj-Napoca 2015",
        "Sticker | MSL | Cluj-Napoca 2015",
        "Sticker | tenzki | Cluj-Napoca 2015",
        "Sticker | Kjaerbye | Cluj-Napoca 2015",
        "Sticker | ScreaM | Cluj-Napoca 2015",
        "Sticker | GruBy | Cluj-Napoca 2015",
        "Sticker | Hyper | Cluj-Napoca 2015",
        "Sticker | markeloff | Cluj-Napoca 2015",
        "Sticker | bondik | Cluj-Napoca 2015",
        "Sticker | FalleN | Cluj-Napoca 2015",
        "Sticker | B1ad3 | Cluj-Napoca 2015",
        "Sticker | shox | Cluj-Napoca 2015",
        "Sticker | shroud | Cluj-Napoca 2015",
        "Sticker | EliGE | Cluj-Napoca 2015",
        "Sticker | Ex6TenZ | Cluj-Napoca 2015",
        "Sticker | rallen | Cluj-Napoca 2015",
        "Sticker | DavCost | Cluj-Napoca 2015",
        "Sticker | pashaBiceps | Cluj-Napoca 2015",
        "Sticker | coldzera | Cluj-Napoca 2015",
        "Sticker | kennyS | Cluj-Napoca 2015",
        "Sticker | RpK | Cluj-Napoca 2015",
        "Sticker | WorldEdit | Cluj-Napoca 2015",
        "Sticker | chrisJ | Cluj-Napoca 2015",
        "Sticker | rain | Cluj-Napoca 2015",
        "Sticker | peet | Cluj-Napoca 2015",
        "Sticker | Furlan | Cluj-Napoca 2015",
        "Sticker | SmithZz | Cluj-Napoca 2015",
        "Sticker | boltz | Cluj-Napoca 2015",
        "Sticker | Flipsid3 Tactics | Cluj-Napoca 2015",
        "Sticker | Luminosity Gaming | Cluj-Napoca 2015",
        "Sticker | Skadoodle | Cluj-Napoca 2015",
        "Sticker | fer | Cluj-Napoca 2015",
        "Sticker | tarik | Cluj-Napoca 2015",
        "Sticker | denis | Cluj-Napoca 2015",
        "Sticker | steel | Cluj-Napoca 2015",
        "Sticker | n0thing | Cluj-Napoca 2015",
        "Sticker | jdm64 | Cluj-Napoca 2015",
        "Sticker | gob b | Cluj-Napoca 2015",
        "Sticker | fox | Cluj-Napoca 2015",
        "Sticker | DreamHack | Cluj-Napoca 2015",
        "Sticker | reltuC | Cluj-Napoca 2015",
        "Sticker | freakazoid | Cluj-Napoca 2015",
        "Sticker | nex | Cluj-Napoca 2015",
        "Sticker | nitr0 | Cluj-Napoca 2015",
        "Sticker | mousesports | Cluj-Napoca 2015",
        "Sticker | Team Liquid | Cluj-Napoca 2015",
        "Sticker | device | Cluj-Napoca 2015",
        "Sticker | adreN | Cluj-Napoca 2015",
        "Sticker | Vexed Gaming | Cluj-Napoca 2015",
        "Sticker | hazed | Cluj-Napoca 2015",
        "Sticker | FNS | Cluj-Napoca 2015",
        "Sticker | Maikelele | Cluj-Napoca 2015",
        "Sticker | dennis | Cluj-Napoca 2015",
        "Sticker | seang@res | Cluj-Napoca 2015",
        "Sticker | Hiko | Cluj-Napoca 2015",
        "Sticker | Snax | Cluj-Napoca 2015",
        "Sticker | olofmeister | Cluj-Napoca 2015",
        "Sticker | NEO | Cluj-Napoca 2015",
        "Sticker | Cloud9 | Cluj-Napoca 2015",
        "Sticker | FugLy | Cluj-Napoca 2015",
        "Sticker | Counter Logic Gaming | Cluj-Napoca 2015",
        "Sticker | Zeus | Cluj-Napoca 2015",
        "Sticker | Happy | Cluj-Napoca 2015",
        "Sticker | karrigan | Cluj-Napoca 2015",
        "Sticker | flamie | Cluj-Napoca 2015",
        "Sticker | G2 Esports | Cluj-Napoca 2015",
        "Sticker | jkaem | Cluj-Napoca 2015",
        "Sticker | GuardiaN | Cluj-Napoca 2015",
        "Sticker | apEX | Cluj-Napoca 2015",
        "Sticker | Edward | Cluj-Napoca 2015",
        "Sticker | Team EnVyUs | Cluj-Napoca 2015",
        "Sticker | GeT_RiGhT | Cluj-Napoca 2015",
        "Sticker | Natus Vincere | Cluj-Napoca 2015",
        "Sticker | byali | Cluj-Napoca 2015",
        "Sticker | seized | Cluj-Napoca 2015",
        "Sticker | TaZ | Cluj-Napoca 2015",
        "Sticker | NBK- | Cluj-Napoca 2015",
        "Sticker | JW | Cluj-Napoca 2015",
        "Sticker | Ninjas in Pyjamas | Cluj-Napoca 2015",
        "Sticker | kioShiMa | Cluj-Napoca 2015",
        "Sticker | Virtus.Pro | Cluj-Napoca 2015",
        "Sticker | f0rest | Cluj-Napoca 2015",
        "Sticker | Xyp9x | Cluj-Napoca 2015",
        "Sticker | Fnatic | Cluj-Napoca 2015",
        "Sticker | cajunb | Cluj-Napoca 2015",
        "Sticker | flusha | Cluj-Napoca 2015",
        "Sticker | dupreeh | Cluj-Napoca 2015",
        "Sticker | friberg | Cluj-Napoca 2015",
        "Sticker | Xizt | Cluj-Napoca 2015",
        "Sticker | pronax | Cluj-Napoca 2015",
        "Sticker | KRIMZ | Cluj-Napoca 2015",
        "Sticker | allu | Cluj-Napoca 2015",
        "Sticker | Team SoloMid | Cluj-Napoca 2015"
      ],
      "Gold": [
        "Sticker | DreamHack (Gold) | Cluj-Napoca 2015",
        "Sticker | Luminosity Gaming (Gold) | Cluj-Napoca 2015",
        "Sticker | Fnatic (Gold) | Cluj-Napoca 2015",
        "Sticker | Team EnVyUs (Gold) | Cluj-Napoca 2015",
        "Sticker | Team SoloMid (Gold) | Cluj-Napoca 2015",
        "Sticker | Titan (Gold) | Cluj-Napoca 2015",
        "Sticker | G2 Esports (Gold) | Cluj-Napoca 2015",
        "Sticker | Cloud9 (Gold) | Cluj-Napoca 2015",
        "Sticker | Virtus.Pro (Gold) | Cluj-Napoca 2015",
        "Sticker | Natus Vincere (Gold) | Cluj-Napoca 2015",
        "Sticker | mousesports (Gold) | Cluj-Napoca 2015",
        "Sticker | Team Liquid (Gold) | Cluj-Napoca 2015",
        "Sticker | Flipsid3 Tactics (Gold) | Cluj-Napoca 2015",
        "Sticker | Vexed Gaming (Gold) | Cluj-Napoca 2015",
        "Sticker | Counter Logic Gaming (Gold) | Cluj-Napoca 2015",
        "Sticker | Team Dignitas (Gold) | Cluj-Napoca 2015",
        "Sticker | Ninjas in Pyjamas (Gold) | Cluj-Napoca 2015",
        "Sticker | TaZ (Gold) | Cluj-Napoca 2015",
        "Sticker | Snax (Gold) | Cluj-Napoca 2015",
        "Sticker | pashaBiceps (Gold) | Cluj-Napoca 2015",
        "Sticker | NEO (Gold) | Cluj-Napoca 2015",
        "Sticker | byali (Gold) | Cluj-Napoca 2015",
        "Sticker | rallen (Gold) | Cluj-Napoca 2015",
        "Sticker | peet (Gold) | Cluj-Napoca 2015",
        "Sticker | Hyper (Gold) | Cluj-Napoca 2015",
        "Sticker | GruBy (Gold) | Cluj-Napoca 2015",
        "Sticker | Furlan (Gold) | Cluj-Napoca 2015",
        "Sticker | Xyp9x (Gold) | Cluj-Napoca 2015",
        "Sticker | karrigan (Gold) | Cluj-Napoca 2015",
        "Sticker | dupreeh (Gold) | Cluj-Napoca 2015",
        "Sticker | device (Gold) | Cluj-Napoca 2015",
        "Sticker | cajunb (Gold) | Cluj-Napoca 2015",
        "Sticker | SmithZz (Gold) | Cluj-Napoca 2015",
        "Sticker | shox (Gold) | Cluj-Napoca 2015",
        "Sticker | ScreaM (Gold) | Cluj-Napoca 2015",
        "Sticker | RpK (Gold) | Cluj-Napoca 2015",
        "Sticker | Ex6TenZ (Gold) | Cluj-Napoca 2015",
        "Sticker | nitr0 (Gold) | Cluj-Napoca 2015",
        "Sticker | Hiko (Gold) | Cluj-Napoca 2015",
        "Sticker | FugLy (Gold) | Cluj-Napoca 2015",
        "Sticker | EliGE (Gold) | Cluj-Napoca 2015",
        "Sticker | adreN (Gold) | Cluj-Napoca 2015",
        "Sticker | tenzki (Gold) | Cluj-Napoca 2015",
        "Sticker | Pimp (Gold) | Cluj-Napoca 2015",
        "Sticker | MSL (Gold) | Cluj-Napoca 2015",
        "Sticker | Kjaerbye (Gold) | Cluj-Napoca 2015",
        "Sticker | aizy (Gold) | Cluj-Napoca 2015",
        "Sticker | Xizt (Gold) | Cluj-Napoca 2015",
        "Sticker | GeT_RiGhT (Gold) | Cluj-Napoca 2015",
        "Sticker | friberg (Gold) | Cluj-Napoca 2015",
        "Sticker | f0rest (Gold) | Cluj-Napoca 2015",
        "Sticker | allu (Gold) | Cluj-Napoca 2015",
        "Sticker | Zeus (Gold) | Cluj-Napoca 2015",
        "Sticker | seized (Gold) | Cluj-Napoca 2015",
        "Sticker | GuardiaN (Gold) | Cluj-Napoca 2015",
        "Sticker | flamie (Gold) | Cluj-Napoca 2015",
        "Sticker | Edward (Gold) | Cluj-Napoca 2015",
        "Sticker | NiKo (Gold) | Cluj-Napoca 2015",
        "Sticker | nex (Gold) | Cluj-Napoca 2015",
        "Sticker | gob b (Gold) | Cluj-Napoca 2015",
        "Sticker | denis (Gold) | Cluj-Napoca 2015",
        "Sticker | chrisJ (Gold) | Cluj-Napoca 2015",
        "Sticker | steel (Gold) | Cluj-Napoca 2015",
        "Sticker | fer (Gold) | Cluj-Napoca 2015",
        "Sticker | FalleN (Gold) | Cluj-Napoca 2015",
        "Sticker | coldzera (Gold) | Cluj-Napoca 2015",
        "Sticker | boltz (Gold) | Cluj-Napoca 2015",
        "Sticker | jkaem (Gold) | Cluj-Napoca 2015",
        "Sticker | rain (Gold) | Cluj-Napoca 2015",
        "Sticker | Maikelele (Gold) | Cluj-Napoca 2015",
        "Sticker | fox (Gold) | Cluj-Napoca 2015",
        "Sticker | dennis (Gold) | Cluj-Napoca 2015",
        "Sticker | pronax (Gold) | Cluj-Napoca 2015",
        "Sticker | olofmeister (Gold) | Cluj-Napoca 2015",
        "Sticker | KRIMZ (Gold) | Cluj-Napoca 2015",
        "Sticker | JW (Gold) | Cluj-Napoca 2015",
        "Sticker | flusha (Gold) | Cluj-Napoca 2015",
        "Sticker | WorldEdit (Gold) | Cluj-Napoca 2015",
        "Sticker | markeloff (Gold) | Cluj-Napoca 2015",
        "Sticker | DavCost (Gold) | Cluj-Napoca 2015",
        "Sticker | bondik (Gold) | Cluj-Napoca 2015",
        "Sticker | B1ad3 (Gold) | Cluj-Napoca 2015",
        "Sticker | NBK- (Gold) | Cluj-Napoca 2015",
        "Sticker | kennyS (Gold) | Cluj-Napoca 2015",
        "Sticker | kioShiMa (Gold) | Cluj-Napoca 2015",
        "Sticker | Happy (Gold) | Cluj-Napoca 2015",
        "Sticker | apEX (Gold) | Cluj-Napoca 2015",
        "Sticker | n0thing (Gold) | Cluj-Napoca 2015",
        "Sticker | Skadoodle (Gold) | Cluj-Napoca 2015",
        "Sticker | shroud (Gold) | Cluj-Napoca 2015",
        "Sticker | seang@res (Gold) | Cluj-Napoca 2015",
        "Sticker | freakazoid (Gold) | Cluj-Napoca 2015",
        "Sticker | tarik (Gold) | Cluj-Napoca 2015",
        "Sticker | jdm64 (Gold) | Cluj-Napoca 2015",
        "Sticker | hazed (Gold) | Cluj-Napoca 2015",
        "Sticker | FNS (Gold) | Cluj-Napoca 2015",
        "Sticker | reltuC (Gold) | Cluj-Napoca 2015"
      ]
    },
    "London 2018": {
      "Holo": [
        "Sticker | North (Holo) | London 2018",
        "Sticker | mousesports (Holo) | London 2018",
        "Sticker | Cloud9 (Holo) | London 2018",
        "Sticker | HellRaisers (Holo) | London 2018",
        "Sticker | OpTic Gaming (Holo) | London 2018",
        "Sticker | FaZe Clan (Holo) | London 2018",
        "Sticker | Team Spirit (Holo) | London 2018",
        "Sticker | Astralis (Holo) | London 2018",
        "Sticker | Vega Squadron (Holo) | London 2018",
        "Sticker | Natus Vincere (Holo) | London 2018",
        "Sticker | G2 Esports (Holo) | London 2018",
        "Sticker | Tyloo (Holo) | London 2018",
        "Sticker | compLexity Gaming (Holo) | London 2018",
        "Sticker | Space Soldiers (Holo) | London 2018",
        "Sticker | Virtus.Pro (Holo) | London 2018",
        "Sticker | Rogue (Holo) | London 2018",
        "Sticker | Gambit Esports (Holo) | London 2018",
        "Sticker | Team Liquid (Holo) | London 2018",
        "Sticker | Fnatic (Holo) | London 2018",
        "Sticker | Ninjas in Pyjamas (Holo) | London 2018",
        "Sticker | MIBR (Holo) | London 2018",
        "Sticker | FACEIT (Holo) | London 2018",
        "Sticker | BIG (Holo) | London 2018",
        "Sticker | Winstrike Team (Holo) | London 2018",
        "Sticker | Renegades (Holo) | London 2018"
      ],
      "Foil": [
        "Sticker | sdy (Foil) | London 2018",
        "Sticker | Twistzz (Foil) | London 2018",
        "Sticker | FaZe Clan (Foil) | London 2018",
        "Sticker | crush (Foil) | London 2018",
        "Sticker | tonyblack (Foil) | London 2018",
        "Sticker | ropz (Foil) | London 2018",
        "Sticker | OpTic Gaming (Foil) | London 2018",
        "Sticker | device (Foil) | London 2018",
        "Sticker | bondik (Foil) | London 2018",
        "Sticker | compLexity Gaming (Foil) | London 2018",
        "Sticker | Cloud9 (Foil) | London 2018",
        "Sticker | Astralis (Foil) | London 2018",
        "Sticker | mousesports (Foil) | London 2018",
        "Sticker | NiKo (Foil) | London 2018",
        "Sticker | Team Spirit (Foil) | London 2018",
        "Sticker | niko (Foil) | London 2018",
        "Sticker | cadiaN (Foil) | London 2018",
        "Sticker | pashaBiceps (Foil) | London 2018",
        "Sticker | HellRaisers (Foil) | London 2018",
        "Sticker | Ninjas in Pyjamas (Foil) | London 2018",
        "Sticker | s1mple (Foil) | London 2018",
        "Sticker | kennyS (Foil) | London 2018",
        "Sticker | G2 Esports (Foil) | London 2018",
        "Sticker | Tyloo (Foil) | London 2018",
        "Sticker | Team Liquid (Foil) | London 2018",
        "Sticker | Natus Vincere (Foil) | London 2018",
        "Sticker | jR (Foil) | London 2018",
        "Sticker | North (Foil) | London 2018",
        "Sticker | FACEIT (Foil) | London 2018",
        "Sticker | Virtus.Pro (Foil) | London 2018",
        "Sticker | Space Soldiers (Foil) | London 2018",
        "Sticker | chopper (Foil) | London 2018",
        "Sticker | autimatic (Foil) | London 2018",
        "Sticker | Vega Squadron (Foil) | London 2018",
        "Sticker | Rogue (Foil) | London 2018",
        "Sticker | Golden (Foil) | London 2018",
        "Sticker | MIBR (Foil) | London 2018",
        "Sticker | Skadoodle (Foil) | London 2018",
        "Sticker | rain (Foil) | London 2018",
        "Sticker | FalleN (Foil) | London 2018",
        "Sticker | Hiko (Foil) | London 2018",
        "Sticker | XANTARES (Foil) | London 2018",
        "Sticker | captainMo (Foil) | London 2018",
        "Sticker | SicK (Foil) | London 2018",
        "Sticker | Xyp9x (Foil) | London 2018",
        "Sticker | Rickeh (Foil) | London 2018",
        "Sticker | DD (Foil) | London 2018",
        "Sticker | somebody (Foil) | London 2018",
        "Sticker | Dima (Foil) | London 2018",
        "Sticker | RUSH (Foil) | London 2018",
        "Sticker | Fnatic (Foil) | London 2018",
        "Sticker | Gambit Esports (Foil) | London 2018",
        "Sticker | jks (Foil) | London 2018",
        "Sticker | vice (Foil) | London 2018",
        "Sticker | EliGE (Foil) | London 2018",
        "Sticker | AdreN (Foil) | London 2018",
        "Sticker | gade (Foil) | London 2018",
        "Sticker | Magisk (Foil) | London 2018",
        "Sticker | karrigan (Foil) | London 2018",
        "Sticker | Winstrike Team (Foil) | London 2018",
        "Sticker | DavCost (Foil) | London 2018",
        "Sticker | Stewie2K (Foil) | London 2018",
        "Sticker | NAF (Foil) | London 2018",
        "Sticker | MSL (Foil) | London 2018",
        "Sticker | BIG (Foil) | London 2018",
        "Sticker | STYKO (Foil) | London 2018",
        "Sticker | Ex6TenZ (Foil) | London 2018",
        "Sticker | S0tF1k (Foil) | London 2018",
        "Sticker | GeT_RiGhT (Foil) | London 2018",
        "Sticker | tarik (Foil) | London 2018",
        "Sticker | dupreeh (Foil) | London 2018",
        "Sticker | fer (Foil) | London 2018",
        "Sticker | Kjaerbye (Foil) | London 2018",
        "Sticker | SmithZz (Foil) | London 2018",
        "Sticker | shox (Foil) | London 2018",
        "Sticker | smooya (Foil) | London 2018",
        "Sticker | nitr0 (Foil) | London 2018",
        "Sticker | Renegades (Foil) | London 2018",
        "Sticker | hutji (Foil) | London 2018",
        "Sticker | Dosia (Foil) | London 2018",
        "Sticker | GuardiaN (Foil) | London 2018",
        "Sticker | v4lde (Foil) | London 2018",
        "Sticker | draken (Foil) | London 2018",
        "Sticker | coldzera (Foil) | London 2018",
        "Sticker | bodyy (Foil) | London 2018",
        "Sticker | nex (Foil) | London 2018",
        "Sticker | aizy (Foil) | London 2018",
        "Sticker | Snappi (Foil) | London 2018",
        "Sticker | tabseN (Foil) | London 2018",
        "Sticker | TACO (Foil) | London 2018",
        "Sticker | COLDYY1 (Foil) | London 2018",
        "Sticker | gla1ve (Foil) | London 2018",
        "Sticker | gob b (Foil) | London 2018",
        "Sticker | Edward (Foil) | London 2018",
        "Sticker | electronic (Foil) | London 2018",
        "Sticker | Kvik (Foil) | London 2018",
        "Sticker | tiziaN (Foil) | London 2018",
        "Sticker | xccurate (Foil) | London 2018",
        "Sticker | paz (Foil) | London 2018",
        "Sticker | k0nfig (Foil) | London 2018",
        "Sticker | MAJ3R (Foil) | London 2018",
        "Sticker | Boombl4 (Foil) | London 2018",
        "Sticker | mou (Foil) | London 2018",
        "Sticker | mir (Foil) | London 2018",
        "Sticker | f0rest (Foil) | London 2018",
        "Sticker | Zeus (Foil) | London 2018",
        "Sticker | yay (Foil) | London 2018",
        "Sticker | cajunb (Foil) | London 2018",
        "Sticker | olofmeister (Foil) | London 2018",
        "Sticker | BnTeT (Foil) | London 2018",
        "Sticker | flamie (Foil) | London 2018",
        "Sticker | NEO (Foil) | London 2018",
        "Sticker | woxic (Foil) | London 2018",
        "Sticker | DeadFox (Foil) | London 2018",
        "Sticker | suNny (Foil) | London 2018",
        "Sticker | MICHU (Foil) | London 2018",
        "Sticker | JW (Foil) | London 2018",
        "Sticker | ShahZaM (Foil) | London 2018",
        "Sticker | byali (Foil) | London 2018",
        "Sticker | Calyx (Foil) | London 2018",
        "Sticker | dennis (Foil) | London 2018",
        "Sticker | oskar (Foil) | London 2018",
        "Sticker | chrisJ (Foil) | London 2018",
        "Sticker | Hobbit (Foil) | London 2018",
        "Sticker | stanislaw (Foil) | London 2018",
        "Sticker | REZ (Foil) | London 2018",
        "Sticker | Snax (Foil) | London 2018",
        "Sticker | JUGi (Foil) | London 2018",
        "Sticker | USTILO (Foil) | London 2018",
        "Sticker | ANDROID (Foil) | London 2018",
        "Sticker | snatchie (Foil) | London 2018",
        "Sticker | ISSAA (Foil) | London 2018",
        "Sticker | waterfaLLZ (Foil) | London 2018",
        "Sticker | flusha (Foil) | London 2018",
        "Sticker | Nifty (Foil) | London 2018",
        "Sticker | KRIMZ (Foil) | London 2018",
        "Sticker | Lekr0 (Foil) | London 2018",
        "Sticker | ANGE1 (Foil) | London 2018",
        "Sticker | jmqa (Foil) | London 2018",
        "Sticker | Xizt (Foil) | London 2018",
        "Sticker | dephh (Foil) | London 2018",
        "Sticker | ngiN (Foil) | London 2018",
        "Sticker | balblna (Foil) | London 2018",
        "Sticker | AZR (Foil) | London 2018",
        "Sticker | jkaem (Foil) | London 2018"
      ],
      "Paper": [
        "Sticker | niko | London 2018",
        "Sticker | bondik | London 2018",
        "Sticker | pashaBiceps | London 2018",
        "Sticker | OpTic Gaming | London 2018",
        "Sticker | Twistzz | London 2018",
        "Sticker | sdy | London 2018",
        "Sticker | s1mple | London 2018",
        "Sticker | kennyS | London 2018",
        "Sticker | NiKo | London 2018",
        "Sticker | device | London 2018",
        "Sticker | compLexity Gaming | London 2018",
        "Sticker | MSL | London 2018",
        "Sticker | ropz | London 2018",
        "Sticker | RUSH | London 2018",
        "Sticker | XANTARES | London 2018",
        "Sticker | tonyblack | London 2018",
        "Sticker | Team Spirit | London 2018",
        "Sticker | mousesports | London 2018",
        "Sticker | FalleN | London 2018",
        "Sticker | HellRaisers | London 2018",
        "Sticker | AdreN | London 2018",
        "Sticker | crush | London 2018",
        "Sticker | FaZe Clan | London 2018",
        "Sticker | fer | London 2018",
        "Sticker | yay | London 2018",
        "Sticker | cadiaN | London 2018",
        "Sticker | captainMo | London 2018",
        "Sticker | chopper | London 2018",
        "Sticker | Virtus.Pro | London 2018",
        "Sticker | nex | London 2018",
        "Sticker | Cloud9 | London 2018",
        "Sticker | mou | London 2018",
        "Sticker | Nifty | London 2018",
        "Sticker | FACEIT | London 2018",
        "Sticker | G2 Esports | London 2018",
        "Sticker | Rogue | London 2018",
        "Sticker | Vega Squadron | London 2018",
        "Sticker | Dima | London 2018",
        "Sticker | Space Soldiers | London 2018",
        "Sticker | MICHU | London 2018",
        "Sticker | Ninjas in Pyjamas | London 2018",
        "Sticker | jR | London 2018",
        "Sticker | DD | London 2018",
        "Sticker | NEO | London 2018",
        "Sticker | Dosia | London 2018",
        "Sticker | Skadoodle | London 2018",
        "Sticker | rain | London 2018",
        "Sticker | somebody | London 2018",
        "Sticker | Magisk | London 2018",
        "Sticker | karrigan | London 2018",
        "Sticker | MAJ3R | London 2018",
        "Sticker | paz | London 2018",
        "Sticker | EliGE | London 2018",
        "Sticker | tarik | London 2018",
        "Sticker | NAF | London 2018",
        "Sticker | Stewie2K | London 2018",
        "Sticker | Fnatic | London 2018",
        "Sticker | Golden | London 2018",
        "Sticker | byali | London 2018",
        "Sticker | Astralis | London 2018",
        "Sticker | TACO | London 2018",
        "Sticker | smooya | London 2018",
        "Sticker | Natus Vincere | London 2018",
        "Sticker | USTILO | London 2018",
        "Sticker | Xyp9x | London 2018",
        "Sticker | jks | London 2018",
        "Sticker | vice | London 2018",
        "Sticker | aizy | London 2018",
        "Sticker | gla1ve | London 2018",
        "Sticker | Winstrike Team | London 2018",
        "Sticker | JW | London 2018",
        "Sticker | North | London 2018",
        "Sticker | Snax | London 2018",
        "Sticker | Calyx | London 2018",
        "Sticker | Tyloo | London 2018",
        "Sticker | Gambit Esports | London 2018",
        "Sticker | dupreeh | London 2018",
        "Sticker | draken | London 2018",
        "Sticker | v4lde | London 2018",
        "Sticker | Hiko | London 2018",
        "Sticker | mir | London 2018",
        "Sticker | S0tF1k | London 2018",
        "Sticker | SicK | London 2018",
        "Sticker | Hobbit | London 2018",
        "Sticker | woxic | London 2018",
        "Sticker | autimatic | London 2018",
        "Sticker | Rickeh | London 2018",
        "Sticker | snatchie | London 2018",
        "Sticker | gob b | London 2018",
        "Sticker | Renegades | London 2018",
        "Sticker | REZ | London 2018",
        "Sticker | JUGi | London 2018",
        "Sticker | GuardiaN | London 2018",
        "Sticker | hutji | London 2018",
        "Sticker | GeT_RiGhT | London 2018",
        "Sticker | tabseN | London 2018",
        "Sticker | BIG | London 2018",
        "Sticker | Team Liquid | London 2018",
        "Sticker | shox | London 2018",
        "Sticker | BnTeT | London 2018",
        "Sticker | nitr0 | London 2018",
        "Sticker | coldzera | London 2018",
        "Sticker | f0rest | London 2018",
        "Sticker | dephh | London 2018",
        "Sticker | DeadFox | London 2018",
        "Sticker | MIBR | London 2018",
        "Sticker | olofmeister | London 2018",
        "Sticker | xccurate | London 2018",
        "Sticker | cajunb | London 2018",
        "Sticker | ngiN | London 2018",
        "Sticker | dennis | London 2018",
        "Sticker | Edward | London 2018",
        "Sticker | Zeus | London 2018",
        "Sticker | DavCost | London 2018",
        "Sticker | STYKO | London 2018",
        "Sticker | Kjaerbye | London 2018",
        "Sticker | SmithZz | London 2018",
        "Sticker | Snappi | London 2018",
        "Sticker | bodyy | London 2018",
        "Sticker | flusha | London 2018",
        "Sticker | Boombl4 | London 2018",
        "Sticker | oskar | London 2018",
        "Sticker | jmqa | London 2018",
        "Sticker | electronic | London 2018",
        "Sticker | tiziaN | London 2018",
        "Sticker | flamie | London 2018",
        "Sticker | suNny | London 2018",
        "Sticker | chrisJ | London 2018",
        "Sticker | gade | London 2018",
        "Sticker | k0nfig | London 2018",
        "Sticker | ANDROID | London 2018",
        "Sticker | waterfaLLZ | London 2018",
        "Sticker | COLDYY1 | London 2018",
        "Sticker | Kvik | London 2018",
        "Sticker | Ex6TenZ | London 2018",
        "Sticker | AZR | London 2018",
        "Sticker | stanislaw | London 2018",
        "Sticker | balblna | London 2018",
        "Sticker | KRIMZ | London 2018",
        "Sticker | Lekr0 | London 2018",
        "Sticker | ANGE1 | London 2018",
        "Sticker | ShahZaM | London 2018",
        "Sticker | ISSAA | London 2018",
        "Sticker | jkaem | London 2018",
        "Sticker | ISSAA | London 2018",
        "Sticker | Xizt | London 2018"
      ],
      "Gold": [
        "Sticker | sdy (Gold) | London 2018",
        "Sticker | s1mple (Gold) | London 2018",
        "Sticker | bondik (Gold) | London 2018",
        "Sticker | Twistzz (Gold) | London 2018",
        "Sticker | ropz (Gold) | London 2018",
        "Sticker | rain (Gold) | London 2018",
        "Sticker | device (Gold) | London 2018",
        "Sticker | niko (Gold) | London 2018",
        "Sticker | tonyblack (Gold) | London 2018",
        "Sticker | NiKo (Gold) | London 2018",
        "Sticker | AdreN (Gold) | London 2018",
        "Sticker | jR (Gold) | London 2018",
        "Sticker | kennyS (Gold) | London 2018",
        "Sticker | fer (Gold) | London 2018",
        "Sticker | cadiaN (Gold) | London 2018",
        "Sticker | jks (Gold) | London 2018",
        "Sticker | nex (Gold) | London 2018",
        "Sticker | FalleN (Gold) | London 2018",
        "Sticker | pashaBiceps (Gold) | London 2018",
        "Sticker | crush (Gold) | London 2018",
        "Sticker | tarik (Gold) | London 2018",
        "Sticker | NAF (Gold) | London 2018",
        "Sticker | captainMo (Gold) | London 2018",
        "Sticker | smooya (Gold) | London 2018",
        "Sticker | electronic (Gold) | London 2018",
        "Sticker | MAJ3R (Gold) | London 2018",
        "Sticker | Stewie2K (Gold) | London 2018",
        "Sticker | EliGE (Gold) | London 2018",
        "Sticker | chopper (Gold) | London 2018",
        "Sticker | shox (Gold) | London 2018",
        "Sticker | Dosia (Gold) | London 2018",
        "Sticker | Xyp9x (Gold) | London 2018",
        "Sticker | XANTARES (Gold) | London 2018",
        "Sticker | somebody (Gold) | London 2018",
        "Sticker | Golden (Gold) | London 2018",
        "Sticker | aizy (Gold) | London 2018",
        "Sticker | snatchie (Gold) | London 2018",
        "Sticker | yay (Gold) | London 2018",
        "Sticker | autimatic (Gold) | London 2018",
        "Sticker | draken (Gold) | London 2018",
        "Sticker | xccurate (Gold) | London 2018",
        "Sticker | DD (Gold) | London 2018",
        "Sticker | Hobbit (Gold) | London 2018",
        "Sticker | DavCost (Gold) | London 2018",
        "Sticker | karrigan (Gold) | London 2018",
        "Sticker | Dima (Gold) | London 2018",
        "Sticker | Skadoodle (Gold) | London 2018",
        "Sticker | hutji (Gold) | London 2018",
        "Sticker | tiziaN (Gold) | London 2018",
        "Sticker | gla1ve (Gold) | London 2018",
        "Sticker | dupreeh (Gold) | London 2018",
        "Sticker | Magisk (Gold) | London 2018",
        "Sticker | flamie (Gold) | London 2018",
        "Sticker | NEO (Gold) | London 2018",
        "Sticker | GeT_RiGhT (Gold) | London 2018",
        "Sticker | Lekr0 (Gold) | London 2018",
        "Sticker | suNny (Gold) | London 2018",
        "Sticker | Zeus (Gold) | London 2018",
        "Sticker | JW (Gold) | London 2018",
        "Sticker | oskar (Gold) | London 2018",
        "Sticker | REZ (Gold) | London 2018",
        "Sticker | S0tF1k (Gold) | London 2018",
        "Sticker | SicK (Gold) | London 2018",
        "Sticker | bodyy (Gold) | London 2018",
        "Sticker | olofmeister (Gold) | London 2018",
        "Sticker | byali (Gold) | London 2018",
        "Sticker | GuardiaN (Gold) | London 2018",
        "Sticker | gade (Gold) | London 2018",
        "Sticker | Rickeh (Gold) | London 2018",
        "Sticker | coldzera (Gold) | London 2018",
        "Sticker | ISSAA (Gold) | London 2018",
        "Sticker | f0rest (Gold) | London 2018",
        "Sticker | RUSH (Gold) | London 2018",
        "Sticker | Snappi (Gold) | London 2018",
        "Sticker | stanislaw (Gold) | London 2018",
        "Sticker | woxic (Gold) | London 2018",
        "Sticker | nitr0 (Gold) | London 2018",
        "Sticker | mou (Gold) | London 2018",
        "Sticker | Edward (Gold) | London 2018",
        "Sticker | jkaem (Gold) | London 2018",
        "Sticker | mir (Gold) | London 2018",
        "Sticker | vice (Gold) | London 2018",
        "Sticker | SmithZz (Gold) | London 2018",
        "Sticker | ANGE1 (Gold) | London 2018",
        "Sticker | STYKO (Gold) | London 2018",
        "Sticker | AZR (Gold) | London 2018",
        "Sticker | DeadFox (Gold) | London 2018",
        "Sticker | tabseN (Gold) | London 2018",
        "Sticker | k0nfig (Gold) | London 2018",
        "Sticker | cajunb (Gold) | London 2018",
        "Sticker | Snax (Gold) | London 2018",
        "Sticker | Kjaerbye (Gold) | London 2018",
        "Sticker | paz (Gold) | London 2018",
        "Sticker | Calyx (Gold) | London 2018",
        "Sticker | Kvik (Gold) | London 2018",
        "Sticker | MSL (Gold) | London 2018",
        "Sticker | ShahZaM (Gold) | London 2018",
        "Sticker | BnTeT (Gold) | London 2018",
        "Sticker | dennis (Gold) | London 2018",
        "Sticker | COLDYY1 (Gold) | London 2018",
        "Sticker | ngiN (Gold) | London 2018",
        "Sticker | JUGi (Gold) | London 2018",
        "Sticker | flusha (Gold) | London 2018",
        "Sticker | TACO (Gold) | London 2018",
        "Sticker | MICHU (Gold) | London 2018",
        "Sticker | Boombl4 (Gold) | London 2018",
        "Sticker | Ex6TenZ (Gold) | London 2018",
        "Sticker | KRIMZ (Gold) | London 2018",
        "Sticker | Hiko (Gold) | London 2018",
        "Sticker | Nifty (Gold) | London 2018",
        "Sticker | jmqa (Gold) | London 2018",
        "Sticker | dephh (Gold) | London 2018",
        "Sticker | USTILO (Gold) | London 2018",
        "Sticker | waterfaLLZ (Gold) | London 2018",
        "Sticker | v4lde (Gold) | London 2018",
        "Sticker | ANDROID (Gold) | London 2018",
        "Sticker | gob b (Gold) | London 2018",
        "Sticker | Xizt (Gold) | London 2018",
        "Sticker | chrisJ (Gold) | London 2018",
        "Sticker | balblna (Gold) | London 2018",
        "Sticker | FACEIT (Gold) | London 2018",
        "Sticker | Tyloo (Gold) | London 2018",
        "Sticker | Team Spirit (Gold) | London 2018",
        "Sticker | Rogue (Gold) | London 2018",
        "Sticker | OpTic Gaming (Gold) | London 2018",
        "Sticker | Renegades (Gold) | London 2018",
        "Sticker | HellRaisers (Gold) | London 2018",
        "Sticker | compLexity Gaming (Gold) | London 2018",
        "Sticker | Ninjas in Pyjamas (Gold) | London 2018",
        "Sticker | Virtus.Pro (Gold) | London 2018",
        "Sticker | North (Gold) | London 2018",
        "Sticker | Team Liquid (Gold) | London 2018",
        "Sticker | Astralis (Gold) | London 2018",
        "Sticker | BIG (Gold) | London 2018",
        "Sticker | Space Soldiers (Gold) | London 2018",
        "Sticker | Vega Squadron (Gold) | London 2018",
        "Sticker | Gambit Esports (Gold) | London 2018",
        "Sticker | Fnatic (Gold) | London 2018",
        "Sticker | G2 Esports (Gold) | London 2018",
        "Sticker | Winstrike Team (Gold) | London 2018",
        "Sticker | mousesports (Gold) | London 2018",
        "Sticker | MIBR (Gold) | London 2018",
        "Sticker | Natus Vincere (Gold) | London 2018",
        "Sticker | FaZe Clan (Gold) | London 2018",
        "Sticker | Cloud9 (Gold) | London 2018"
      ]
    }
  }
};

// Extract all tournament collections from tiers (excluding "Exclusive")
const ALL_TOURNAMENT_COLLECTIONS: { name: string; tier: string }[] = [];
Object.entries(STICKER_TIERS_NESTED).forEach(([tier, tournaments]) => {
  Object.keys(tournaments).forEach((tournament) => {
    if (tournament !== "Exclusive") {
      ALL_TOURNAMENT_COLLECTIONS.push({ name: tournament, tier });
    }
  });
});
// Also add newer tournaments from ExtraStickersData (Katowice 2019, 2020 RMR, Stockholm 2021, ... Austin 2025, Budapest 2025)
EXTRA_TOURNAMENT_COLLECTIONS.forEach(col => {
  if (!ALL_TOURNAMENT_COLLECTIONS.some(c => c.name === col.name)) {
    ALL_TOURNAMENT_COLLECTIONS.push(col);
  }
});

// Extract all individual stickers from tiers
const ALL_STICKER_NAMES: string[] = [];
Object.values(STICKER_TIERS_NESTED).forEach((tournaments) => {
  Object.values(tournaments).forEach((types) => {
    Object.values(types).forEach((stickers) => {
      ALL_STICKER_NAMES.push(...stickers);
    });
  });
});
// Also add newer stickers from ExtraStickersData
EXTRA_STICKERS.forEach(s => {
  if (!ALL_STICKER_NAMES.includes(s)) {
    ALL_STICKER_NAMES.push(s);
  }
});

export interface StickerFilter {
  name: string;
  slot: string;
  isWhole: boolean; // true = whole sticker, false = scratched
  price: number;
  searchCollection?: boolean; // true = search for collections, false = search for sticker names
  wearMin?: number; // 0-100, default 100
  wearMax?: number; // 0-100, default 100
}

interface StickerPercentFilter {
  enabled: boolean;
  min: number;
  max: number;
}

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  sectionId?: FilterSectionType;
  isFlashing?: boolean;
}

const FilterSection = ({ title, children, defaultOpen = true, sectionId, isFlashing }: FilterSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Auto-open and scroll when flashing
  useEffect(() => {
    if (isFlashing && sectionRef.current) {
      setIsOpen(true);
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isFlashing]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={`filter-section ${isFlashing ? 'filter-section-flash' : ''}`}>
      <div ref={sectionRef} data-filter-section={sectionId}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-primary transition-colors">
          {title}
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Sticker Search Input with Autocomplete
interface StickerSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  searchCollection: boolean;
  placeholder?: string;
}

const StickerSearchInput = ({ value, onChange, searchCollection, placeholder }: StickerSearchInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on mode and input
  const getSuggestions = () => {
    const searchTerm = value.toLowerCase().trim();

    if (searchCollection) {
      // Collection mode: show all matching tournaments
      if (!searchTerm) {
        return ALL_TOURNAMENT_COLLECTIONS;
      }
      return ALL_TOURNAMENT_COLLECTIONS.filter(c =>
        c.name.toLowerCase().includes(searchTerm)
      );
    } else {
      // Sticker mode: show all matching individual stickers
      if (!searchTerm) return [];
      return ALL_STICKER_NAMES.filter(s =>
        s.toLowerCase().includes(searchTerm)
      );
    }
  };

  const suggestions = getSuggestions();
  const showDropdown = isOpen && inputFocused && (searchCollection || value.trim().length > 0) && suggestions.length > 0;

  // Update dropdown position when showing
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [showDropdown, value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: string) => {
    onChange(item);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        placeholder={searchCollection ? "Search collections..." : (placeholder || "Search sticker...")}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setInputFocused(true);
          setIsOpen(true);
        }}
        onBlur={() => {
          // Delay to allow click on dropdown item
          setTimeout(() => setInputFocused(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="w-full bg-transparent border-0 text-sm h-[46px] px-3 focus:outline-none placeholder:text-muted-foreground/60"
      />

      {/* Autocomplete Dropdown - rendered via Portal to escape overflow:hidden containers */}
      {showDropdown && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
          className="z-[9999] bg-popover border border-border rounded-md shadow-xl max-h-[280px] overflow-hidden flex flex-col"
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-secondary/30 shrink-0">
            <span className="text-xs text-muted-foreground">
              {searchCollection ? "Collections" : "Stickers"}
            </span>
            <button
              onClick={() => {
                setIsOpen(false);
                setInputFocused(false);
              }}
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
              title="Close (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1">
            {searchCollection ? (
              // Collection mode - show tournament collections (simple list without tier badges)
              <div className="p-1">
                {(suggestions as typeof ALL_TOURNAMENT_COLLECTIONS).map((collection, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(collection.name)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/80 rounded-sm transition-colors text-foreground"
                  >
                    {collection.name}
                  </button>
                ))}
              </div>
            ) : (
              // Sticker mode - show individual stickers
              <div className="p-1">
                {(suggestions as string[]).map((sticker, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(sticker)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/80 rounded-sm transition-colors truncate"
                  >
                    {sticker}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

interface StickersCharmsTabProps {
  stickers?: StickerFilter[];
  onStickersChange?: (stickers: StickerFilter[]) => void;
  maxSlots?: number;
  stickerPercent?: StickerPercentFilter;
  onStickerPercentChange?: (percent: StickerPercentFilter) => void;
  flashSection?: FilterSectionType | null;
}

// Tier Quick Select Component - 4-level navigation: Tier -> Tournament -> Type -> Sticker
interface TierQuickSelectProps {
  onSelectSticker: (stickerName: string) => void;
  onSearchTournament?: (tournamentName: string) => void;
}

const TierQuickSelect = ({ onSelectSticker, onSearchTournament }: TierQuickSelectProps) => {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleTierSelect = (tier: string) => {
    setSelectedTier(tier);
    setSelectedTournament(null);
    setSelectedType(null);
  };

  const handleTournamentSelect = (tournament: string) => {
    setSelectedTournament(tournament);
    setSelectedType(null);
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
  };

  const handleStickerSelect = (sticker: string) => {
    onSelectSticker(sticker);
    setIsOpen(false);
    setSelectedTier(null);
    setSelectedTournament(null);
    setSelectedType(null);
  };

  const handleBack = () => {
    if (selectedType) {
      setSelectedType(null);
    } else if (selectedTournament) {
      setSelectedTournament(null);
    } else if (selectedTier) {
      setSelectedTier(null);
    }
  };

  const [stickerSearch, setStickerSearch] = useState("");
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderedStickers, setReorderedStickers] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      const newOrder = [...reorderedStickers];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(index, 0, removed);
      setReorderedStickers(newOrder);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const renderContent = () => {
    // Level 4: Sticker list
    if (selectedTier && selectedTournament && selectedType) {
      const originalStickers = STICKER_TIERS_NESTED[selectedTier]?.[selectedTournament]?.[selectedType] || [];

      // Initialize reordered stickers when entering reorder mode
      const displayStickers = isReorderMode
        ? reorderedStickers
        : (stickerSearch.trim()
          ? originalStickers.filter(s => s.toLowerCase().includes(stickerSearch.toLowerCase()))
          : originalStickers);

      // Get button style based on type
      const getTypeButtonClass = () => {
        switch (selectedType) {
          case "Holo":
            return "holo-button-effect text-white border border-purple-400/50";
          case "Foil":
            return "foil-button-effect text-white border border-slate-300/40";
          case "Paper":
            return "bg-stone-600/30 text-stone-200 border border-stone-400/30";
          case "Gold":
            return "bg-yellow-500/25 text-yellow-300 border border-yellow-400/50";
          default:
            return "bg-secondary/50 border border-border text-muted-foreground";
        }
      };

      const toggleReorderMode = () => {
        if (!isReorderMode) {
          // Entering reorder mode - copy current stickers
          setReorderedStickers([...originalStickers]);
        }
        setIsReorderMode(!isReorderMode);
      };

      return (
        <div className="space-y-2">
          {/* Back button, edit button, and search in one row */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md transition-all duration-300 relative overflow-hidden hover:scale-105 ${getTypeButtonClass()}`}
            >
              <ChevronDown className="h-3 w-3 rotate-90 transition-transform duration-200" />
              {selectedType}
            </button>

            {/* Edit/Reorder button */}
            <button
              onClick={toggleReorderMode}
              className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${isReorderMode
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:text-primary hover:bg-primary/10"
                }`}
              title={isReorderMode ? "Exit reorder mode" : "Reorder stickers"}
            >
              <Pencil className="h-3 w-3" />
            </button>

            {!isReorderMode && (
              <div className="relative flex-1 group">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={stickerSearch}
                  onChange={(e) => setStickerSearch(e.target.value)}
                  className="w-full h-7 pl-7 pr-2 text-xs bg-input border border-border rounded-md 
                    focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50
                    placeholder:text-muted-foreground/60 
                    transition-all duration-300 ease-out"
                />
              </div>
            )}

            {isReorderMode && (
              <span className="text-[10px] text-muted-foreground flex-1 text-center">
                Drag to reorder
              </span>
            )}
          </div>

          <ScrollArea className="h-[200px]">
            <div className="space-y-0.5">
              {displayStickers.length > 0 ? displayStickers.map((sticker, index) => (
                isReorderMode ? (
                  <div
                    key={sticker}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 w-full text-xs h-8 px-2 rounded-md cursor-grab active:cursor-grabbing transition-all duration-150 ${draggedIndex === index
                      ? "opacity-50 bg-primary/20"
                      : dragOverIndex === index
                        ? "bg-primary/30 border border-primary/50"
                        : "bg-secondary/30 hover:bg-secondary/50"
                      }`}
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{sticker}</span>
                  </div>
                ) : (
                  <Button
                    key={sticker}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      handleStickerSelect(sticker);
                      setStickerSearch("");
                    }}
                    className={`w-full justify-start text-xs h-8 px-2 transition-all duration-200 ease-out ${selectedType === "Holo"
                      ? "hover:bg-purple-500/20 hover:text-purple-200 hover:translate-x-1"
                      : selectedType === "Foil"
                        ? "hover:bg-slate-400/20 hover:text-slate-200 hover:translate-x-1"
                        : selectedType === "Paper"
                          ? "hover:bg-stone-500/20 hover:text-stone-200 hover:translate-x-1"
                          : selectedType === "Gold"
                            ? "hover:bg-yellow-500/20 hover:text-yellow-200 hover:translate-x-1"
                            : "hover:bg-primary/20 hover:text-primary hover:translate-x-1"
                      }`}
                    style={{
                      animationDelay: `${index * 20}ms`,
                      animation: 'fade-in 0.2s ease-out forwards'
                    }}
                  >
                    {sticker}
                  </Button>
                )
              )) : (
                <div className="text-xs text-muted-foreground text-center py-4 animate-fade-in">
                  No stickers found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      );
    }


    // Level 2: Tournament list with inline type buttons
    if (selectedTier) {
      const tournaments = Object.keys(STICKER_TIERS_NESTED[selectedTier] || {});
      return (
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className={`w-full justify-start text-xs mb-2 ${selectedTier === "Tier 1" ? "text-[#e4ae39] hover:bg-[#e4ae39]/15" :
              selectedTier === "Tier 2" ? "text-[#eb4b4b] hover:bg-[#eb4b4b]/15" :
                selectedTier === "Tier 3" ? "text-[#d32ce6] hover:bg-[#d32ce6]/15" :
                  "text-[#8847ff] hover:bg-[#8847ff]/15"
              }`}
          >
            <ChevronDown className="h-3 w-3 mr-1 rotate-90" /> {selectedTier}
          </Button>
          <div className="space-y-2">
            {tournaments.map((tournament) => {
              const types = Object.keys(STICKER_TIERS_NESTED[selectedTier]?.[tournament] || {});
              // Reorder: Holo first, then Foil, then Paper, then others
              const orderedTypes = ['Holo', 'Foil', 'Paper', 'Gold'].filter(t => types.includes(t));
              const remainingTypes = types.filter(t => !orderedTypes.includes(t));
              const sortedTypes = [...orderedTypes, ...remainingTypes];

              const handleTournamentClick = () => {
                onSearchTournament?.(tournament);
                setIsOpen(false);
                setSelectedTier(null);
                setSelectedTournament(null);
                setSelectedType(null);
              };

              // Special styling for Exclusive category - compact prominent button
              if (tournament === "Exclusive") {
                return (
                  <Button
                    key={tournament}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedTournament(tournament);
                      setSelectedType("Special");
                    }}
                    className={`w-full justify-center text-sm h-9 font-semibold border transition-all duration-200 ${selectedTier === "Tier 1"
                      ? "text-[#e4ae39] border-[#e4ae39]/40 bg-[#e4ae39]/8 hover:bg-[#e4ae39]/15 hover:border-[#e4ae39]/70"
                      : selectedTier === "Tier 2"
                        ? "text-[#eb4b4b] border-[#eb4b4b]/40 bg-[#eb4b4b]/8 hover:bg-[#eb4b4b]/15 hover:border-[#eb4b4b]/70"
                        : selectedTier === "Tier 3"
                          ? "text-[#d32ce6] border-[#d32ce6]/40 bg-[#d32ce6]/8 hover:bg-[#d32ce6]/15 hover:border-[#d32ce6]/70"
                          : "text-[#8847ff] border-[#8847ff]/40 bg-[#8847ff]/8 hover:bg-[#8847ff]/15 hover:border-[#8847ff]/70"
                      }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {tournament}
                  </Button>
                );
              }

              return (
                <div key={tournament} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-secondary/30 transition-colors">
                  <button
                    onClick={handleTournamentClick}
                    className="text-sm font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors text-left"
                    title={`Search for "${tournament}"`}
                  >
                    {tournament}
                  </button>
                  <div className="flex gap-1">
                    {sortedTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setSelectedTournament(tournament);
                          setSelectedType(type);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer relative overflow-hidden ${type === "Holo"
                          ? "holo-button-effect text-white border border-purple-400/50 hover:border-purple-300/80"
                          : type === "Foil"
                            ? "foil-button-effect text-white border border-slate-300/40 hover:border-slate-200/70"
                            : type === "Paper"
                              ? "bg-stone-600/30 text-stone-200 border border-stone-400/30 hover:bg-stone-500/40 hover:border-stone-400/60"
                              : type === "Gold"
                                ? "bg-yellow-500/25 text-yellow-300 border border-yellow-400/50 hover:bg-yellow-500/40 hover:border-yellow-400/80 hover:shadow-[0_0_10px_rgba(234,179,8,0.4)]"
                                : "bg-secondary/50 border border-border hover:bg-secondary"
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Level 1: Tier list - CS2 rarity colors
    return (
      <div className="space-y-1">
        {Object.keys(STICKER_TIERS_NESTED).map((tier) => (
          <Button
            key={tier}
            variant="ghost"
            size="sm"
            onClick={() => handleTierSelect(tier)}
            className={`w-full justify-start text-sm h-10 font-medium ${tier === "Tier 1" ? "text-[#e4ae39] hover:bg-[#e4ae39]/15" :  // Contraband orange
              tier === "Tier 2" ? "text-[#eb4b4b] hover:bg-[#eb4b4b]/15" :  // Covert red
                tier === "Tier 3" ? "text-[#d32ce6] hover:bg-[#d32ce6]/15" :  // Classified pink
                  "text-[#8847ff] hover:bg-[#8847ff]/15"  // Restricted purple
              }`}
          >
            <Layers className="h-4 w-4 mr-2" />
            {tier}
            <ChevronDown className="h-4 w-4 ml-auto -rotate-90" />
          </Button>
        ))}
      </div>
    );
  };

  const getTitle = () => {
    if (selectedType) return "Select Sticker";
    if (selectedTier) return "Select Tournament & Type";
    return "Select Tier";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
          title="Quick select sticker by tier"
        >
          <Layers className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3 bg-popover border-border z-50"
        align="start"
        side="bottom"
      >
        <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
          {getTitle()}
        </div>
        {renderContent()}
      </PopoverContent>
    </Popover>
  );
};

export const StickersCharmsTab = ({
  stickers: externalStickers,
  onStickersChange,
  maxSlots = 5,
  stickerPercent,
  onStickerPercentChange,
  flashSection
}: StickersCharmsTabProps) => {
  const { playSound } = useSoundSettings();
  const [stickers, setStickers] = useState<StickerFilter[]>(

    externalStickers && externalStickers.length > 0 ? externalStickers : [{ name: "", slot: "any", isWhole: true, price: 0 }]
  );

  useEffect(() => {
    if (externalStickers && externalStickers.length > 0) {
      setStickers(externalStickers);
    }
  }, [externalStickers]);

  const updateStickers = (newStickers: StickerFilter[]) => {
    setStickers(newStickers);
    onStickersChange?.(newStickers);
  };

  const addSticker = () => {
    if (stickers.length >= maxSlots) return;
    updateStickers([...stickers, { name: "", slot: "any", isWhole: true, price: 0 }]);
  };

  const removeSticker = (index: number) => {
    const newStickers = stickers.filter((_, i) => i !== index);
    updateStickers(newStickers);
  };

  const duplicateSticker = (index: number) => {
    if (stickers.length >= 5) return;
    const stickerToCopy = stickers[index];
    const newStickers = [...stickers];
    // For slot 5 (Custom), keep the slot value; otherwise reset to "any"
    const newSlot = stickerToCopy.slot === "5" ? "5" : "any";
    newStickers.splice(index + 1, 0, { ...stickerToCopy, slot: newSlot });
    updateStickers(newStickers);
  };

  const updateSticker = (index: number, field: keyof StickerFilter, value: string) => {
    const newStickers = [...stickers];
    if (field === 'isWhole') {
      newStickers[index] = { ...newStickers[index], isWhole: value === "true" };
    } else if (field === 'searchCollection') {
      newStickers[index] = { ...newStickers[index], searchCollection: value === "true" };
    } else if (field === 'price') {
      newStickers[index] = { ...newStickers[index], price: Number(value) || 0 };
    } else {
      newStickers[index] = { ...newStickers[index], [field]: value };
    }
    updateStickers(newStickers);
  };

  const getAvailableSlots = (currentIndex: number) => {
    const usedSlots = stickers
      .filter((_, i) => i !== currentIndex)
      .map(s => s.slot)
      .filter(s => s !== "any" && s !== "5"); // Only track slots 1-4 as exclusive

    return ["any", "1", "2", "3", "4", "5"].filter(
      slot => slot === "any" || slot === "5" || !usedSlots.includes(slot) || stickers[currentIndex]?.slot === slot
    );
  };

  // Wear popover state
  const [openWearPopoverIdx, setOpenWearPopoverIdx] = useState<number | null>(null);
  const [wearPresets, setWearPresets] = useState<{ min: number; max: number }[]>(() => {
    try { return JSON.parse(localStorage.getItem('sticker-wear-presets') || '[]'); } catch { return []; }
  });
  const [creatingWearPreset, setCreatingWearPreset] = useState(false);
  const [newWearSliderValues, setNewWearSliderValues] = useState([50, 100]);

  const updateStickerWear = (index: number, wearMin: number, wearMax: number) => {
    const newStickers = [...stickers];
    // UI: 0% = whole/intact, 100% = worn
    // API: wear_min=100,wear_max=100 = whole; wear_min=0,wear_max=0 = worn
    // So we invert: UI 0% → API 100, UI 100% → API 0
    const invertedMin = 100 - wearMax;
    const invertedMax = 100 - wearMin;
    const isWhole = wearMin === 0 && wearMax === 0; // 0% in UI = whole
    newStickers[index] = { ...newStickers[index], wearMin: invertedMin, wearMax: invertedMax, isWhole };
    updateStickers(newStickers);
  };

  const saveWearPresets = (presets: { min: number; max: number }[]) => {
    setWearPresets(presets);
    try { localStorage.setItem('sticker-wear-presets', JSON.stringify(presets)); } catch {}
  };

  const startCreatingWearPreset = () => {
    if (wearPresets.length >= 6) return;
    setNewWearSliderValues([50, 100]);
    setCreatingWearPreset(true);
  };

  const confirmCreateWearPreset = () => {
    const [min, max] = newWearSliderValues;
    if (max >= min) saveWearPresets([...wearPresets, { min, max }]);
    setCreatingWearPreset(false);
  };

  const cancelCreateWearPreset = () => setCreatingWearPreset(false);

  const removeWearPreset = (idx: number) => {
    saveWearPresets(wearPresets.filter((_, i) => i !== idx));
  };

  const handleStickerPercentSliderChange = (values: number[]) => {
    playSound();
    onStickerPercentChange?.({
      enabled: stickerPercent?.enabled ?? false,
      min: values[0],
      max: values[1]
    });
  };


  const handleStickerPercentToggle = (checked: boolean) => {
    onStickerPercentChange?.({
      enabled: checked,
      min: stickerPercent?.min ?? 0,
      max: stickerPercent?.max ?? 100
    });
  };

  const handleStickerPercentInputChange = (field: 'min' | 'max', value: number) => {
    onStickerPercentChange?.({
      enabled: stickerPercent?.enabled ?? false,
      min: field === 'min' ? value : (stickerPercent?.min ?? 0),
      max: field === 'max' ? value : (stickerPercent?.max ?? 100)
    });
  };

  return (
    <ScrollArea className="h-full">
      <div className="bg-sidebar p-4 space-y-4">
        {/* Stickers */}
        <FilterSection title="Stickers" sectionId="stickers" isFlashing={flashSection === 'stickers'}>
          <div className="space-y-2">
            {/* Add Sticker Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={addSticker}
              disabled={stickers.length >= maxSlots}
              className={`w-full border-dashed ${stickers.length >= maxSlots
                ? 'border-muted-foreground/30 text-muted-foreground cursor-not-allowed'
                : 'border-primary/50 text-primary hover:bg-primary/10 hover:border-primary'
                }`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Sticker ({stickers.length}/{maxSlots})
            </Button>

            {/* Sticker List */}
            {stickers.map((sticker, index) => (
              <div
                key={index}
                className="rounded-lg overflow-hidden bg-secondary/80 border border-primary/20 group hover:border-primary/40 transition-colors"
              >
                {/* Row 1: Sticker Name + Clear/Copy/Delete */}
                <div className="flex items-center bg-input rounded-t-lg">
                  <StickerSearchInput
                    value={sticker.name}
                    onChange={(value) => updateSticker(index, "name", value)}
                    searchCollection={sticker.searchCollection ?? false}
                    placeholder="Search sticker..."
                  />

                  {/* Clear Button - Eraser icon */}
                  {sticker.name && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateSticker(index, "name", "")}
                      className="h-[46px] w-10 text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0"
                      title="Clear sticker name"
                    >
                      <Eraser className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Duplicate Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => duplicateSticker(index)}
                    disabled={stickers.length >= 5}
                    className="h-[46px] w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                    title="Duplicate sticker"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSticker(index)}
                    className="h-[46px] w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    title="Remove sticker"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Row 2: Collection Toggle + Wear Condition + Slot + Tier Quick Select + Price */}
                <div className="flex items-stretch px-2 py-1 bg-background/50 border-t border-primary/10">
                  {/* Left Side: Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Collection Search Toggle - RED */}
                    <div className="flex items-center">
                      <Checkbox
                        checked={sticker.searchCollection ?? false}
                        onCheckedChange={(checked) => {
                          const newStickers = [...stickers];
                          newStickers[index] = {
                            ...newStickers[index],
                            searchCollection: !!checked,
                          };
                          updateStickers(newStickers);
                        }}
                        className={`h-[18px] w-[18px] ${sticker.searchCollection
                          ? "border-destructive data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                          : "border-destructive/50"
                          }`}
                      />
                    </div>

                    {/* Sticker Wear Range Badge with Popover */}
                    {(() => {
                      // API stores inverted values (0 = worn, 100 = intact), UI shows (0% = whole/intact, 100% = worn)
                      const apiWMin = sticker.wearMin ?? 100;
                      const apiWMax = sticker.wearMax ?? 100;
                      // Invert back for UI display
                      const wMin = 100 - apiWMax;
                      const wMax = 100 - apiWMin;
                      const is0 = wMin === 0 && wMax === 0; // 0% in UI = whole
                      const is100 = wMin === 100 && wMax === 100; // 100% = worn = red
                      const label = is0 ? '0%' : is100 ? '100%' : wMin === wMax ? `${wMin}%` : `${wMin}–${wMax}%`;
                      const active0 = is0;
                      const active100 = is100;

                      return (
                        <Popover open={openWearPopoverIdx === index} onOpenChange={(open) => { setOpenWearPopoverIdx(open ? index : null); if (!open) setCreatingWearPreset(false); }}>
                          <PopoverTrigger asChild>
                            <button
                              className={`h-7 px-2.5 rounded text-[13px] font-bold transition-all border cursor-pointer flex items-center gap-1 hover:ring-1 hover:ring-offset-1 hover:ring-offset-background ${
                                is0
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/60 hover:ring-emerald-500/30'
                                  : is100
                                    ? 'bg-destructive/15 border-destructive/40 text-destructive hover:bg-destructive/25 hover:border-destructive/60 hover:ring-destructive/30'
                                    : 'bg-[hsl(var(--cs-purple)/0.15)] border-[hsl(var(--cs-purple)/0.4)] text-[hsl(var(--cs-purple))] hover:bg-[hsl(var(--cs-purple)/0.25)] hover:border-[hsl(var(--cs-purple)/0.6)] hover:ring-[hsl(var(--cs-purple)/0.3)]'
                              }`}
                            >
                              {label}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[260px] p-0 z-[100] border-border/60 bg-[hsl(var(--popover))] shadow-xl shadow-black/40" align="start" side="right" sideOffset={8} collisionPadding={16}>
                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
                              <span className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">Wear %</span>
                              <span className="text-[11px] font-mono text-[hsl(var(--cs-purple))]">{label}</span>
                            </div>

                            <div className="p-3 space-y-2.5">
                              {/* Quick select: 0% (green) | + | 100% (red) */}
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => { updateStickerWear(index, 0, 0); setOpenWearPopoverIdx(null); }}
                                  className={`flex-1 py-1.5 rounded text-[13px] font-bold border transition-all ${
                                    active0
                                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                                      : 'bg-emerald-500/8 border-emerald-500/25 text-emerald-400/70 hover:bg-emerald-500/15 hover:border-emerald-500/40 hover:text-emerald-400 hover:shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                                  }`}
                                >
                                  0%
                                </button>
                                {wearPresets.length < 6 && (
                                  <button
                                    onClick={() => creatingWearPreset ? cancelCreateWearPreset() : startCreatingWearPreset()}
                                    className={`w-8 shrink-0 py-1.5 rounded text-[11px] font-bold border flex items-center justify-center ${
                                      creatingWearPreset
                                        ? 'bg-[hsl(var(--cs-purple)/0.2)] border-[hsl(var(--cs-purple)/0.5)] text-[hsl(var(--cs-purple))]'
                                        : 'bg-secondary/30 border-border/40 text-muted-foreground/40 hover:border-[hsl(var(--cs-purple)/0.4)] hover:text-[hsl(var(--cs-purple)/0.8)] hover:bg-[hsl(var(--cs-purple)/0.05)]'
                                    }`}
                                    title={creatingWearPreset ? "Cancel" : "New preset"}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => { updateStickerWear(index, 100, 100); setOpenWearPopoverIdx(null); }}
                                  className={`flex-1 py-1.5 rounded text-[13px] font-bold border transition-all ${
                                    active100
                                      ? 'bg-destructive/25 border-destructive/60 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.35)]'
                                      : 'bg-destructive/8 border-destructive/25 text-red-400/70 hover:bg-destructive/15 hover:border-destructive/40 hover:text-red-400 hover:shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                                  }`}
                                >
                                  100%
                                </button>
                              </div>

                              {/* Preset creation UI */}
                              {creatingWearPreset && (
                                <div className="space-y-2 p-2.5 rounded border border-[hsl(var(--cs-purple)/0.25)] bg-[hsl(var(--cs-purple)/0.04)] animate-in fade-in-0 slide-in-from-top-1 duration-150">
                                  <div className="relative">
                                    <div
                                      className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full pointer-events-none"
                                      style={{
                                        background: `linear-gradient(90deg,
                                          hsl(270 20% 12%) 0%,
                                          hsl(270 35% 22%) 30%,
                                          hsl(270 45% 35%) 65%,
                                          hsl(270 55% 50%) 100%)`
                                      }}
                                    />
                                    <Slider
                                      min={0} max={100} step={1}
                                      value={newWearSliderValues}
                                      onValueChange={(v) => {
                                        playSound();
                                        setNewWearSliderValues([v[0], v[1]]);
                                      }}
                                      transparentTrack
                                      className="w-full"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex-1 relative">
                                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground/40 pointer-events-none uppercase">min</span>
                                      <input
                                        type="number" min={0} max={100}
                                        value={newWearSliderValues[0]}
                                        onChange={(e) => {
                                          const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                          setNewWearSliderValues([Math.min(v, newWearSliderValues[1]), newWearSliderValues[1]]);
                                        }}
                                        className="w-full h-6 rounded border border-border/60 bg-input px-2 pr-5 text-[11px] font-mono text-center text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--cs-purple)/0.5)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40 pointer-events-none">%</span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground/30 shrink-0">—</span>
                                    <div className="flex-1 relative">
                                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground/40 pointer-events-none uppercase">max</span>
                                      <input
                                        type="number" min={0} max={100}
                                        value={newWearSliderValues[1]}
                                        onChange={(e) => {
                                          const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                          setNewWearSliderValues([newWearSliderValues[0], Math.max(v, newWearSliderValues[0])]);
                                        }}
                                        className="w-full h-6 rounded border border-border/60 bg-input px-2 pr-5 text-[11px] font-mono text-center text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--cs-purple)/0.5)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40 pointer-events-none">%</span>
                                    </div>
                                    <button
                                      onClick={confirmCreateWearPreset}
                                      className="h-6 px-3 shrink-0 rounded text-[10px] font-semibold bg-[hsl(var(--cs-purple)/0.2)] border border-[hsl(var(--cs-purple)/0.4)] text-[hsl(var(--cs-purple))] hover:bg-[hsl(var(--cs-purple)/0.3)] transition-all"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Custom presets */}
                              {wearPresets.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {wearPresets.map((preset, pIdx) => {
                                    const pActive = wMin === preset.min && wMax === preset.max;
                                    const pLabel = preset.min === preset.max ? `${preset.min}%` : `${preset.min}–${preset.max}%`;
                                    return (
                                      <div key={pIdx} className="relative group min-w-0" style={{ width: 'calc(33.333% - 2.67px)' }}>
                                        <button
                                          onClick={() => updateStickerWear(index, preset.min, preset.max)}
                                          className={`w-full py-1 rounded text-[10px] font-semibold border transition-all truncate px-1 ${
                                            pActive
                                              ? 'bg-[hsl(var(--cs-purple)/0.2)] border-[hsl(var(--cs-purple)/0.5)] text-[hsl(var(--cs-purple))] shadow-[0_0_8px_hsl(var(--cs-purple)/0.2)]'
                                              : 'bg-secondary/20 border-border/30 text-muted-foreground/60 hover:bg-secondary/40 hover:text-foreground/80 hover:border-border/60'
                                          }`}
                                        >
                                          {pLabel}
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); removeWearPreset(pIdx); }}
                                          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[7px] hover:bg-destructive"
                                        >
                                          <X className="h-1.5 w-1.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Main slider */}
                              {!creatingWearPreset && (
                                <>
                                  <div className="border-t border-border/20 pt-2" />
                                  <div className="space-y-2">
                                    <div className="relative">
                                      <div
                                        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full pointer-events-none"
                                        style={{ background: `linear-gradient(90deg, hsl(270 20% 12%) 0%, hsl(270 35% 22%) 30%, hsl(270 45% 35%) 65%, hsl(270 55% 50%) 100%)` }}
                                      />
                                      <Slider
                                        min={0} max={100} step={1}
                                        value={[wMin, wMax]}
                                        onValueChange={(v) => {
                                          playSound();
                                          updateStickerWear(index, v[0], v[1]);
                                        }}
                                        transparentTrack
                                        className="w-full relative z-10"
                                      />

                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex-1 relative">
                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground/40 pointer-events-none uppercase">min</span>
                                        <input
                                          type="number" min={0} max={100}
                                          value={wMin}
                                          onChange={(e) => {
                                            const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                            updateStickerWear(index, Math.min(v, wMax), wMax);
                                          }}
                                          className="w-full h-6 rounded border border-border/60 bg-input px-2 pr-5 text-[11px] font-mono text-center text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--cs-purple)/0.5)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40 pointer-events-none">%</span>
                                      </div>
                                      <span className="text-[9px] text-muted-foreground/30 shrink-0">—</span>
                                      <div className="flex-1 relative">
                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground/40 pointer-events-none uppercase">max</span>
                                        <input
                                          type="number" min={0} max={100}
                                          value={wMax}
                                          onChange={(e) => {
                                            const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                            updateStickerWear(index, wMin, Math.max(v, wMin));
                                          }}
                                          className="w-full h-6 rounded border border-border/60 bg-input px-2 pr-5 text-[11px] font-mono text-center text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--cs-purple)/0.5)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/40 pointer-events-none">%</span>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })()}

                    {/* Slot Selector */}
                    <Select
                      value={sticker.slot}
                      onValueChange={(value) => updateSticker(index, "slot", value)}
                    >
                      <SelectTrigger className="w-14 bg-secondary/50 border-0 rounded h-7 hover:bg-secondary/80 focus:ring-0 focus:ring-offset-0 px-1.5 justify-center [&>svg]:hidden">
                        <SelectValue>
                          <span className="text-sm font-bold text-primary truncate">
                            {sticker.slot === "any" ? "Slot" : sticker.slot}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50 min-w-[90px]">
                        {getAvailableSlots(index).map(slot => (
                          <SelectItem
                            key={slot}
                            value={slot}
                            className="py-2 cursor-pointer justify-center [&>span:first-child]:h-2.5 [&>span:first-child]:w-2.5 [&>span:first-child]:absolute [&>span:first-child]:left-1 hover:bg-primary/20 focus:bg-primary/20 data-[highlighted]:bg-primary/20"
                          >
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-semibold">
                                {slot === "any" ? "Any" : `Slot ${slot}`}
                              </span>
                              {slot === "5" && (
                                <span className="text-[10px] text-muted-foreground italic -mt-0.5">Custom</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Tier Quick Select */}
                    <TierQuickSelect
                      onSelectSticker={(name) => updateSticker(index, "name", name)}
                      onSearchTournament={(tournament) => updateSticker(index, "name", tournament)}
                    />
                  </div>

                  {/* Right Side: Price Display - flex-1 to take remaining space */}
                  <div className="flex-1 bg-muted/50 rounded h-7 flex items-center justify-center border border-border/50 cursor-default ml-2">
                    <span className="text-xs text-muted-foreground select-none pointer-events-none">
                      {sticker.name.trim() ? `$${sticker.price > 0 ? sticker.price.toFixed(2) : "0.00"}` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {stickers.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground/60">
                No stickers added. Click "Add Sticker" to start.
              </div>
            )}

            {/* Clear All Button - shown when there are stickers */}
            {stickers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStickers([])}
                className="w-full border-destructive/30 text-destructive/70 hover:bg-destructive/10 hover:border-destructive hover:text-destructive mt-2"
              >
                <Eraser className="h-3.5 w-3.5 mr-2" />
                Clear All Stickers
              </Button>
            )}
          </div>
        </FilterSection>
      </div>
    </ScrollArea>
  );
};
