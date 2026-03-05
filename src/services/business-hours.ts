import { DateTime } from "luxon";
import { BUSINESS_HOURS } from "../config/constants";

type DayName =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export function checkBusinessHours(): {
  isOpen: boolean;
  currentTime: string;
  nextOpenTime: string | null;
  message: string;
} {
  const now = DateTime.now().setZone(BUSINESS_HOURS.timezone);
  const dayName = now.toFormat("cccc").toLowerCase() as DayName;
  const schedule = BUSINESS_HOURS.schedule[dayName];

  if (!schedule) {
    // Weekend
    const nextMonday = now.plus({ days: dayName === "saturday" ? 2 : 1 });
    return {
      isOpen: false,
      currentTime: now.toFormat("cccc h:mm a ZZZZ"),
      nextOpenTime: nextMonday.set({ hour: 8, minute: 0 }).toISO(),
      message:
        "Our office is currently closed for the weekend. We reopen Monday at 8 AM Eastern.",
    };
  }

  const [openH, openM] = schedule.open.split(":").map(Number);
  const [closeH, closeM] = schedule.close.split(":").map(Number);
  const openTime = now.set({ hour: openH, minute: openM, second: 0 });
  const closeTime = now.set({ hour: closeH, minute: closeM, second: 0 });

  if (now >= openTime && now < closeTime) {
    return {
      isOpen: true,
      currentTime: now.toFormat("cccc h:mm a ZZZZ"),
      nextOpenTime: null,
      message: "We are currently open.",
    };
  }

  // Before opening or after closing
  let nextOpen: DateTime;
  if (now < openTime) {
    nextOpen = openTime;
  } else {
    // After close — find next business day
    let next = now.plus({ days: 1 });
    while (true) {
      const nextDay = next.toFormat("cccc").toLowerCase() as DayName;
      if (BUSINESS_HOURS.schedule[nextDay]) {
        const [nh, nm] = BUSINESS_HOURS.schedule[nextDay]!.open
          .split(":")
          .map(Number);
        nextOpen = next.set({ hour: nh, minute: nm, second: 0 });
        break;
      }
      next = next.plus({ days: 1 });
    }
  }

  return {
    isOpen: false,
    currentTime: now.toFormat("cccc h:mm a ZZZZ"),
    nextOpenTime: nextOpen!.toISO(),
    message: `Our office is currently closed. Our hours are Monday through Friday, 8 AM to 5 PM Eastern Time.`,
  };
}
