// Option lists. The values (id) must match backend/schemas.py exactly.
export const VIBES = [
  { id: "Beach", icon: "Waves", blurb: "Sun, sand and sea", from: "#7CC6E4", to: "#3F95C4" },
  { id: "Mountains", icon: "Mountain", blurb: "Hills, valleys and fresh air", from: "#9DB7D5", to: "#5D7FA6" },
  { id: "Cultural", icon: "Landmark", blurb: "Heritage, temples and crafts", from: "#F1C27D", to: "#D98F3E" },
  { id: "Urban", icon: "Building2", blurb: "Cities, food and nightlife", from: "#A9A4E0", to: "#6F68C4" },
  { id: "Adventure", icon: "Compass", blurb: "Thrills and the outdoors", from: "#8AD1A8", to: "#3E9C6C" },
];

export const BUDGETS = [
  { id: "Budget", blurb: "Hostels, street food, public transport" },
  { id: "Moderate", blurb: "Comfortable hotels, local restaurants" },
  { id: "Luxury", blurb: "Premium stays, private experiences" },
];

export const PARTIES = [
  { id: "Solo", travelers: 1, icon: "User" },
  { id: "Couple", travelers: 2, icon: "Heart" },
  { id: "Family", travelers: 4, icon: "Users" },
  { id: "Friends", travelers: 4, icon: "PartyPopper" },
];

export const PACES = [
  { id: "Relaxed", blurb: "More downtime, lighter days" },
  { id: "Moderate", blurb: "A balanced mix" },
  { id: "Fast-Paced", blurb: "See as much as possible" },
];

export const INTERESTS = [
  { id: "Food", icon: "Utensils" },
  { id: "Adventure", icon: "Mountain" },
  { id: "History", icon: "Castle" },
  { id: "Nature", icon: "TreePine" },
  { id: "Shopping", icon: "ShoppingBag" },
  { id: "Nightlife", icon: "Music" },
];

export const SLOTS = [
  { id: "morning", label: "Morning", icon: "Sunrise" },
  { id: "lunch", label: "Lunch", icon: "Utensils" },
  { id: "afternoon", label: "Afternoon", icon: "Sun" },
  { id: "evening", label: "Evening", icon: "Moon" },
];

export const MAX_DAYS = 14;
