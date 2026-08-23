import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Picks an option from an antd Select.
 *
 * antd renders each dropdown into a portal and keeps it mounted after closing, so
 * several dropdowns can match `.ant-select-dropdown:visible` at once and position
 * is not a reliable way to find the right one. Each combobox owns a list whose id
 * is `<input id>_list`, and the input id is set on mount, so that is what this
 * follows — `aria-controls` only appears once the dropdown has opened.
 *
 * @param optionText narrows to one option; omit to take the first one offered.
 */
export async function selectOption(
  page: Page,
  scope: Page | Locator,
  label: string,
  optionText?: string,
): Promise<void> {
  const input = scope.getByLabel(label, { exact: true });
  const inputId = await input.getAttribute("id");

  await input.click();

  const dropdown = inputId
    ? page.locator(`.ant-select-dropdown:has(#${inputId}_list)`)
    : page.locator(".ant-select-dropdown:visible");

  const options = dropdown.locator(".ant-select-item-option");
  const option = optionText ? options.filter({ hasText: optionText }).first() : options.first();

  await option.click();

  // antd renders the choice back into the combobox; without this the next action
  // can run before the form has the value.
  await expect(input).toHaveAttribute("aria-expanded", "false");
}
