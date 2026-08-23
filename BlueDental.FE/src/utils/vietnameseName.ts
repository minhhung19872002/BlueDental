/**
 * The UI shows one "Họ và tên" field, as the reference does, while the API keeps
 * họ (lastName) and tên (firstName) apart. The name is captured whole and split
 * on the way out.
 */
export function splitVietnameseName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }

  // Vietnamese order puts the given name last; everything before it is họ + đệm.
  return {
    firstName: parts[parts.length - 1],
    lastName: parts.slice(0, -1).join(" "),
  };
}
