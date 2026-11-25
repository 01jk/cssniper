export const getProxyAddress = (proxyStr: string | null | undefined): string => {
  if (!proxyStr) return "";
  const schemes = ["socks5h://", "socks5://", "https://", "http://"];
  for (const scheme of schemes) {
    if (proxyStr.startsWith(scheme)) {
      return proxyStr.slice(scheme.length);
    }
  }
  return proxyStr;
};

export const getProxyPrefix = (globalProxyType: string | null | undefined): string => {
  const type = globalProxyType || "http";
  return type === "https" ? "https://" : type === "socks5h" ? "socks5h://" : type === "socks5" ? "socks5://" : "http://";
};

export const formatProxyInput = (input: string, globalProxyType: string | null | undefined): string => {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const address = getProxyAddress(trimmed);
  const prefix = getProxyPrefix(globalProxyType);
  return prefix + address;
};
