const toSafeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const createOutlineNode = ({
  id = "",
  level = 1,
  text = "",
  from = 0,
  to = 0
} = {}) => ({
  id: String(id || ""),
  level: Math.max(1, Math.min(6, toSafeNumber(level, 1))),
  text: String(text || ""),
  from: toSafeNumber(from),
  to: toSafeNumber(to)
});
