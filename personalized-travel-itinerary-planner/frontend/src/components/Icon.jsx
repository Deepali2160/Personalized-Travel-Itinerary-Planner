import {
  Building2, Castle, Compass, Heart, Landmark, Moon, Mountain, Music, PartyPopper,
  ShoppingBag, Sun, Sunrise, TreePine, User, Users, Utensils, Waves,
} from "lucide-react";

// Maps the icon names used in constants.js to real icons.
const MAP = {
  Building2, Castle, Compass, Heart, Landmark, Moon, Mountain, Music, PartyPopper,
  ShoppingBag, Sun, Sunrise, TreePine, User, Users, Utensils, Waves,
};

export default function Icon({ name, size = 18, ...rest }) {
  const Cmp = MAP[name] || Compass;
  return <Cmp size={size} aria-hidden="true" {...rest} />;
}
