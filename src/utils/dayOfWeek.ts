export const DAYS_OF_WEEK = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
];

export const dayOfWeekToInt = (day: string | number): number | null => {
    // Accept either a numeric day index (0=SUNDAY..6=SATURDAY) or a day name string
    if (typeof day === "number") {
        return Number.isInteger(day) && day >= 0 && day <= 6 ? day : null;
    }

    if (typeof day === "string" && /^\d+$/.test(day.trim())) {
        const parsed = Number(day);

        return parsed >= 0 && parsed <= 6 ? parsed : null;
    }

    const index = DAYS_OF_WEEK.indexOf(day?.toUpperCase?.());

    return index === -1 ? null : index;
};

// Prisma stores TIME columns as a Date with the time-of-day in UTC
export const formatTime = (value: Date | null): string | null =>
    value ? value.toISOString().substring(11, 19) : null;

export const parseTime = (value: string): Date =>
    new Date(`1970-01-01T${value}.000Z`);
