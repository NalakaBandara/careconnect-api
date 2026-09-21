export type FieldErrors = Record<string, string[]>;

// Shared shape for validation/conflict errors that need per-field messages for form UIs
export const fieldErrorResponse = (
    fields: FieldErrors,
    message = "Validation failed",
    code = "INVALID_REQUEST"
) => ({
    error: { code, message, fields },
});
