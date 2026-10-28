"use strict";

// Preserve the existing translation catalog while presenting DanzStak's own
// social-product names. Internal API and storage names remain unchanged.
for (const dictionary of Object.values(window.danzstakTranslations || {})) {
  dictionary["Your Mix"] ||= dictionary.Feed || "Your Mix";
  dictionary.Flashes ||= dictionary.Stories || "Flashes";
  dictionary["The Roll"] ||= dictionary.Reels || "The Roll";
  dictionary.Tribes ||= dictionary.Groups || "Tribes";
  dictionary["Back to Your Mix"] ||= dictionary["Back to Feed"] || "Back to Your Mix";
  dictionary["Tribe name"] ||= dictionary["Group name"] || "Tribe name";
  dictionary["Create Tribe"] ||= dictionary["Create Group"] || "Create Tribe";
  dictionary["Join Tribe"] ||= dictionary["Join Group"] || "Join Tribe";
  dictionary["Leave Tribe"] ||= dictionary["Leave Group"] || "Leave Tribe";
  dictionary["Add to The Roll"] ||= dictionary["Add Reel"] || "Add to The Roll";
}
