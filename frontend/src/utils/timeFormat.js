export function formatTime12(timeStr) {
  if (!timeStr) return "";
  
  // Normalize string if it's already in 12-hour format like "9:00 AM" or "09:00 AM"
  if (/^([0-9]|0[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i.test(timeStr)) {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
    const h = parseInt(match[1], 10);
    const hoursStr = h < 10 ? `0${h}` : h.toString();
    return `${hoursStr}:${match[2]} ${match[3].toUpperCase()}`;
  }

  // Handle Date object
  if (timeStr instanceof Date) {
    let hours = timeStr.getHours();
    const minutes = timeStr.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const hoursStr = hours < 10 ? `0${hours}` : hours.toString();
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();
    return `${hoursStr}:${minutesStr} ${ampm}`;
  }

  // Handle ISO string
  if (typeof timeStr === "string" && (timeStr.includes("T") || timeStr.includes("-"))) {
    const dateObj = new Date(timeStr);
    if (!isNaN(dateObj.getTime())) {
      let hours = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = hours < 10 ? `0${hours}` : hours.toString();
      const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();
      return `${hoursStr}:${minutesStr} ${ampm}`;
    }
  }

  // Handle 24h "H:MM:SS", "HH:MM:SS", "H:MM", or "HH:MM" format
  if (typeof timeStr === "string") {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = hours < 10 ? `0${hours}` : hours.toString();
      return `${hoursStr}:${minutes} ${ampm}`;
    }
  }

  return timeStr;
}

/**
 * Convert 12-hour time components back to 24-hour "HH:MM" string for backend storage/Date building
 */
export function time12To24(hour, minute, ampm) {
  let h = parseInt(hour, 10);
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  const hStr = h < 10 ? `0${h}` : h.toString();
  return `${hStr}:${minute}`;
}

/**
 * Split a 24-hour time string ("HH:MM") or a Date or a 12h string into components for select dropdowns
 */
export function splitTimeTo12Components(timeStr) {
  if (!timeStr) return { hour: "09", minute: "00", ampm: "AM" };
  const formatted = formatTime12(timeStr);
  const match = formatted.match(/^(\d{2}):(\d{2})\s?(AM|PM)$/i);
  if (match) {
    return { hour: match[1], minute: match[2], ampm: match[3].toUpperCase() };
  }
  return { hour: "09", minute: "00", ampm: "AM" };
}
