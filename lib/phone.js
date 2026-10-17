/**
 * Nigerian phone number helpers, shared by Edit Profile and the WhatsApp
 * opt-in prompt. Moved here unchanged from app/edit-profile/page.jsx.
 * Stored numbers are international without "+": 234XXXXXXXXXX.
 */

// Validate phone number (Nigerian format: 08012345678 or 8012345678)
export const validatePhone = (value) => {
  if (!value) return ""; // Empty is valid
  
  // Remove all non-digit characters
  const cleaned = value.replace(/\D/g, "");
  
  // Nigerian mobile network prefixes
  const validPrefixes = [
    '0701', '0702', '0703', '0704', '0705', '0706', '0707', '0708', '0709',
    '0802', '0803', '0804', '0805', '0806', '0807', '0808', '0809',
    '0810', '0811', '0812', '0813', '0814', '0815', '0816', '0817', '0818', '0819',
    '0902', '0903', '0904', '0905', '0906', '0907', '0908', '0909',
    '0912', '0913', '0915', '0916'
  ];
  
  // Check if it starts with 0 or is just 10 digits
  if (cleaned.startsWith("0")) {
    // Format: 08012345678 (11 digits)
    if (cleaned.length !== 11) {
      return "Phone must be 11 digits (e.g., 08012345678)";
    }
    // Check if starts with valid Nigerian prefix
    const prefix = cleaned.substring(0, 4);
    if (!validPrefixes.includes(prefix)) {
      return "Invalid Nigerian mobile number";
    }
  } else {
    // Format: 8012345678 (10 digits)
    if (cleaned.length !== 10) {
      return "Phone must be 10-11 digits (e.g., 8012345678 or 08012345678)";
    }
    // Check if starts with valid Nigerian prefix (without leading 0)
    const prefix = "0" + cleaned.substring(0, 3);
    if (!validPrefixes.includes(prefix)) {
      return "Invalid Nigerian mobile number";
    }
  }
  
  return "";
};

// Convert Nigerian format to international format (234XXXXXXXXXX)
export const convertToInternationalFormat = (nigerianPhone) => {
  if (!nigerianPhone) return null;
  
  const cleaned = nigerianPhone.replace(/\D/g, "");
  
  // If starts with 0, remove it and prepend 234
  if (cleaned.startsWith("0")) {
    return "234" + cleaned.substring(1);
  }
  
  // If 10 digits without 0, just prepend 234
  return "234" + cleaned;
};

/** Stored 234XXXXXXXXXX → 08XXXXXXXXX for display in an input. */
export const toDisplayPhone = (storedPhone) => {
  if (!storedPhone) return "";
  return storedPhone.startsWith("234") ? "0" + storedPhone.substring(3) : storedPhone;
};
