export const getDesktopBridge = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.desktopPty || null;
};

export const isDesktopRuntime = () => {
  const bridge = getDesktopBridge();
  return Boolean(bridge && bridge.isDesktop);
};
