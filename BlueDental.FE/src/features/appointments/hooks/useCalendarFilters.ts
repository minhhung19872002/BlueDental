import { useState, useMemo, useCallback } from "react";

export function useCalendarFilters() {
  const [keyword, setKeyword] = useState("");
  const [doctorIds, setDoctorIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [slotMinutes, setSlotMinutes] = useState<15 | 30>(30);

  const toggleStatus = (key: string) => {
    setStatusFilter((current) => (current === key ? undefined : key));
  };

  const toggleSlotMinutes = () => {
    setSlotMinutes((current) => (current === 30 ? 15 : 30));
  };

  const filterCount = useMemo(() => {
    let count = 0;
    if (keyword.trim()) count++;
    if (doctorIds.length > 0) count++;
    if (statusFilter) count++;
    return count;
  }, [keyword, doctorIds, statusFilter]);

  const clearAll = useCallback(() => {
    setKeyword("");
    setDoctorIds([]);
    setStatusFilter(undefined);
  }, []);

  return {
    keyword,
    setKeyword,
    doctorIds,
    setDoctorIds,
    statusFilter,
    toggleStatus,
    slotMinutes,
    toggleSlotMinutes,
    filterCount,
    clearAll,
  };
}
