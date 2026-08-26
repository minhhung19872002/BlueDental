import { useCallback, useState } from "react";
import type { FormInstance } from "antd";
import {
  pickBatchItemValues,
  type VoucherBatchItemValues,
  type VoucherFormValues,
} from "../types/voucherForm";
import { generateRandomCode, sanitizeVoucherCode } from "../utils/voucherCode";

export interface BatchVoucherItem {
  code: string;
  name: string;
  nameError: boolean;
  values: VoucherBatchItemValues;
}

export interface VoucherBatchState {
  items: BatchVoucherItem[];
  configAll: boolean;
  selectedIndex: number;
  activate: (singleTabCode: string | undefined) => void;
  setCount: (value: number | null) => void;
  selectItem: (index: number) => void;
  toggleConfigAll: (checked: boolean) => void;
  renameItem: (index: number, name: string) => void;
  changeSelectedCode: (raw: string) => void;
  shuffleSelectedCode: () => void;
  markNameErrors: (indices: number[]) => void;
  finalize: () => BatchVoucherItem[];
  reset: () => void;
}

function newItem(values: VoucherBatchItemValues, code?: string): BatchVoucherItem {
  return { code: code ?? generateRandomCode(), name: "", nameError: false, values };
}

/**
 * State of the "Tạo một lượt" tab. The shared form is the editing surface:
 * with "Cấu hình tất cả" it holds the configuration of every code, otherwise
 * it holds the selected card's, and switching selection snapshots the form
 * into the card it was editing before loading the next one.
 */
export function useVoucherBatch(form: FormInstance<VoucherFormValues>): VoucherBatchState {
  const [items, setItems] = useState<BatchVoucherItem[]>([]);
  const [configAll, setConfigAll] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const snapshot = useCallback(
    () => pickBatchItemValues(form.getFieldsValue(true) as VoucherFormValues),
    [form],
  );

  const stampInto = useCallback(
    (target: "all" | number) => {
      const values = snapshot();
      setItems((prev) =>
        prev.map((it, i) => (target === "all" || i === target ? { ...it, values } : it)),
      );
    },
    [snapshot],
  );

  // The ref opens the tab with card #1 carrying the code already shown on
  // the "Tạo theo số lượng" tab.
  const activate = useCallback(
    (singleTabCode: string | undefined) => {
      if (items.length === 0) {
        const count = (form.getFieldValue("batchCount") as number | undefined) ?? 1;
        const values = snapshot();
        setItems(
          Array.from({ length: count }, (_, i) =>
            newItem(values, i === 0 && singleTabCode ? singleTabCode : undefined),
          ),
        );
      } else if (singleTabCode) {
        setItems((prev) => [{ ...prev[0], code: singleTabCode }, ...prev.slice(1)]);
        if (!configAll && selectedIndex === 0) {
          form.setFieldsValue({ batchCode: singleTabCode });
        }
      }
    },
    [items.length, configAll, selectedIndex, form, snapshot],
  );

  const setCount = useCallback(
    (value: number | null) => {
      const n = Math.min(Math.max(value ?? 1, 1), 100);
      const values = snapshot();
      setItems((prev) =>
        n <= prev.length
          ? prev.slice(0, n)
          : [...prev, ...Array.from({ length: n - prev.length }, () => newItem(values))],
      );
      setSelectedIndex((s) => Math.min(s, n - 1));
    },
    [snapshot],
  );

  const selectItem = useCallback(
    (index: number) => {
      if (configAll) {
        stampInto("all");
        setConfigAll(false);
      } else if (index !== selectedIndex) {
        stampInto(selectedIndex);
        form.setFieldsValue(items[index].values);
      }
      setSelectedIndex(index);
      form.setFieldsValue({ batchCode: items[index].code });
    },
    [configAll, selectedIndex, items, form, stampInto],
  );

  const toggleConfigAll = useCallback(
    (checked: boolean) => {
      // Both directions start every card from what the form holds now.
      stampInto("all");
      setConfigAll(checked);
      if (!checked) {
        form.setFieldsValue({ batchCode: items[selectedIndex]?.code ?? "" });
      }
    },
    [stampInto, form, items, selectedIndex],
  );

  const renameItem = useCallback((index: number, name: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, name, nameError: false } : it)),
    );
  }, []);

  const changeSelectedCode = useCallback(
    (raw: string) => {
      const code = sanitizeVoucherCode(raw);
      form.setFieldsValue({ batchCode: code });
      setItems((prev) =>
        prev.map((it, i) => (i === selectedIndex ? { ...it, code } : it)),
      );
    },
    [form, selectedIndex],
  );

  const shuffleSelectedCode = useCallback(() => {
    changeSelectedCode(generateRandomCode());
  }, [changeSelectedCode]);

  const markNameErrors = useCallback((indices: number[]) => {
    setItems((prev) =>
      prev.map((it, i) => ({ ...it, nameError: indices.includes(i) })),
    );
  }, []);

  // Writes the form into its current target and returns the resulting items
  // synchronously, so the submit handler does not race the state update.
  const finalize = useCallback(() => {
    const values = snapshot();
    const next = items.map((it, i) =>
      configAll || i === selectedIndex ? { ...it, values } : it,
    );
    setItems(next);
    return next;
  }, [items, configAll, selectedIndex, snapshot]);

  const reset = useCallback(() => {
    setItems([]);
    setConfigAll(true);
    setSelectedIndex(0);
  }, []);

  return {
    items,
    configAll,
    selectedIndex,
    activate,
    setCount,
    selectItem,
    toggleConfigAll,
    renameItem,
    changeSelectedCode,
    shuffleSelectedCode,
    markNameErrors,
    finalize,
    reset,
  };
}
