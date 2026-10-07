/**
 * A patient or guardian phone as the forms accept it: 8–15 digits, or the
 * same length shown masked ("090****567") to an account with "Ẩn số điện
 * thoại" (Cụm 11 mục 9). A masked value sent back unchanged keeps the real
 * number on the server; one it cannot match is refused there.
 */
export const PATIENT_PHONE_PATTERN = /^[\d*]{8,15}$/;
