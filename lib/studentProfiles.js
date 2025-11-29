"use client";

const DEFAULT_PROFILE_ID = "primary-profile";

export function buildPrimaryProfileName(student) {
  const first = student?.first_name?.trim() || "";
  const last = student?.last_name?.trim() || "";
  const full = `${first} ${last}`.trim();
  return full || student?.name || student?.email || "Primary Student";
}

export function getExtraProfiles(student) {
  if (!student) return [];
  const raw = student.extra_profiles;
  if (!Array.isArray(raw)) return [];
  return raw;
}

export function findProfileById(student, profileId) {
  if (!profileId || profileId === DEFAULT_PROFILE_ID) {
    return {
      id: DEFAULT_PROFILE_ID,
      name: buildPrimaryProfileName(student),
      isPrimary: true,
    };
  }

  const extraProfiles = getExtraProfiles(student);
  const match = extraProfiles.find((profile) => profile.id === profileId);
  if (match) {
    return {
      id: match.id,
      name: match.name || match.first_name || match.label || "Student",
      grade_level: match.grade_level,
      isPrimary: false,
    };
  }

  // Fallback to primary profile if the id can't be found
  return {
    id: DEFAULT_PROFILE_ID,
    name: buildPrimaryProfileName(student),
    isPrimary: true,
  };
}

export function getActiveProfile(student) {
  if (!student) {
    return null;
  }
  return findProfileById(student, student.active_profile_id);
}

export function buildProfileOptions(student) {
  if (!student) return [];

  const primaryName = buildPrimaryProfileName(student);
  const options = [
    {
      id: DEFAULT_PROFILE_ID,
      name: primaryName,
      badge: "Primary",
      isPrimary: true,
    },
  ];

  const extraProfiles = getExtraProfiles(student);
  extraProfiles.forEach((profile) => {
    options.push({
      id: profile.id,
      name: profile.name || profile.first_name || "Student",
      grade_level: profile.grade_level,
      isPrimary: false,
    });
  });

  return options;
}

export function createEmptyProfile() {
  return {
    id: crypto?.randomUUID?.() || `profile-${Date.now()}`,
    name: "",
    grade_level: "",
    notes: "",
  };
}

export function sanitizeProfiles(profiles = []) {
  return profiles.map((profile) => ({
    id: profile.id || crypto?.randomUUID?.() || `profile-${Date.now()}`,
    name: profile.name?.trim() || "Student",
    grade_level: profile.grade_level?.trim() || null,
    notes: profile.notes?.trim() || null,
  }));
}

export function getProfileDisplayName(student, profileId) {
  if (!student) return "";
  const profile = findProfileById(student, profileId);
  return profile?.name || buildPrimaryProfileName(student);
}

export { DEFAULT_PROFILE_ID };




