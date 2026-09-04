export const DAYS_OF_WEEK = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
];

export const dayOfWeekToInt = (day: string): number | null => {
    const index = DAYS_OF_WEEK.indexOf(day?.toUpperCase());

    return index === -1 ? null : index;
};

// Prisma stores TIME columns as a Date with the time-of-day in UTC
export const formatTime = (value: Date | null): string | null =>
    value ? value.toISOString().substring(11, 19) : null;

export const parseTime = (value: string): Date =>
    new Date(`1970-01-01T${value}.000Z`);
