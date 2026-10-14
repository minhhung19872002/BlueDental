import { PHONE_PATTERN } from "@/components/PhoneInput";

/**
 * A patient or guardian phone as the forms accept it — the PhoneInput rule:
 * 8–15 digits for a Vietnamese number, "+" country code for a foreign one,
 * either shown masked ("090****567") to an account with "Ẩn số điện thoại"
 * (Cụm 11 mục 9). A masked value sent back unchanged keeps the real number on
 * the server; one it cannot match is refused there.
 */
export const PATIENT_PHONE_PATTERN = PHONE_PATTERN;
