interface Props {
  name: string;
  position: string;
  avatarUrl: string | null;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/**
 * Who the leave is for. The design also has Mã NV, Bộ phận and Phép còn lại;
 * the staff record carries none of them, so — as the owner asked — they are
 * left out rather than shown as placeholders.
 */
export function LeaveStaffHeader({ name, position, avatarUrl }: Props) {
  return (
    <div className="lv-staff">
      {avatarUrl ? (
        <img className="lv-staff-avatar" src={avatarUrl} alt="" />
      ) : (
        <span className="lv-staff-avatar" aria-hidden>
          {initials(name)}
        </span>
      )}
      <div className="bd-min0">
        <p className="lv-staff-name">{name}</p>
        {position && <p className="lv-staff-pos">{position}</p>}
      </div>
    </div>
  );
}
